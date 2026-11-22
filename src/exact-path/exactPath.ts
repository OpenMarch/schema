/**
 * Exact paths: one marcher's walk during one move, stored as fixed shapes plus
 * timing keys. This module is the format itself: its types, the rules a path
 * must keep (EP-1 to EP-6) and how a reader plays it (EP-R).
 *
 * The rules come from OpenMarch's ADR 0018 and its timeline spec, Appendix M.
 * This file is the shared copy of that format: OpenMarch and other apps import
 * it from here instead of writing the math themselves.
 *
 * The type has no units. In a `.om` file it holds steps on the same axes as
 * `coordinates` (see `exactPaths` in the show schema). OpenMarch uses the same
 * functions with its own field units, y down; flipping y reverses each arc's
 * direction, so its `bend` changes sign.
 */

/** A point: `[x, y]` */
export type XY = readonly [x: number, y: number];

/**
 * Ticks per beat: 480, the MIDI PPQ that DAWs use. It divides evenly by 2, 3,
 * 4, 5, 6, 8, 10, 12 and 16.
 */
export const TICKS_PER_BEAT = 480;

/** Straight lines through `points`: each point is a corner, the last is the shape's end. */
export interface ExactPoints {
	kind: "points";
	points: XY[];
}

/**
 * A circular arc to `to`. `bend` is the signed sagitta over the chord: the apex
 * is `M + bend·c·n`, with `M` the chord's midpoint, `c` its length and
 * `n = (−dy, dx)/c` the chord direction turned +90° in the path's own axes.
 * `0 < |bend| ≤ 1/2` (at most a half turn).
 *
 * In a `.om` file y points up the field, so a positive `bend` on a chord along
 * +x bows toward the back. Converting to y down (OpenMarch on screen, SVG)
 * negates `bend` along with every y.
 */
export interface ExactArc {
	kind: "arc";
	to: XY;
	bend: number;
}

/** A cubic Bézier curve from the shape's start through `c1`, `c2` to `to`. */
export interface ExactCubic {
	kind: "cubic";
	c1: XY;
	c2: XY;
	to: XY;
}

export type ExactShape = ExactPoints | ExactArc | ExactCubic;

/**
 * A timing key: at `tick` (whole ticks from the move's start) the marcher is at
 * place `u`, the piece number plus the share of that piece's length (0 to the
 * piece count).
 */
export interface ExactKey {
	tick: number;
	u: number;
}

/** One marcher's walk during one move. */
export interface ExactPath {
	v: 1;
	/** Where the walk starts */
	from: XY;
	/** At least one; each starts where the last ended */
	shapes: ExactShape[];
	/** At least two; see EP-5 */
	keys: ExactKey[];
}

/** The id of a rule an exact path must keep. */
export type ExactPathRule = "EP-1" | "EP-2" | "EP-3" | "EP-4" | "EP-5" | "EP-6";

/** One rule a path breaks, with the rule's id. */
export interface ExactPathProblem {
	rule: ExactPathRule;
	message: string;
	/** Where in the path, e.g. `["shapes", 2, "bend"]`; empty for the whole path */
	path: (string | number)[];
}

/** EP-6: a path shorter than this goes nowhere and has no exact path. */
export const EXACT_MIN_LENGTH = 1e-9;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/**
 * One piece of a path: a straight leg, an arc or a cubic. Lengths are the real
 * ones (EP-2 to EP-4): exact for legs and arcs, a cubic's true arc length to a
 * relative error under 1e-9.
 */
export interface ExactPiece {
	kind: "line" | "arc" | "cubic";
	from: XY;
	to: XY;
	length: number;
	/** The point at share `f` (0 to 1) of the piece's length */
	pointAt(f: number): XY;
}

const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const hyp = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function linePiece(from: XY, to: XY): ExactPiece {
	return {
		kind: "line",
		from,
		to,
		length: hyp(from, to),
		pointAt: (f) =>
			f <= 0
				? from
				: f >= 1
					? to
					: [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f],
	};
}

/** An arc's circle (EP-3): centre, radius, start angle and signed sweep. */
export interface ArcCircle {
	center: XY;
	radius: number;
	startAngle: number;
	sweep: number;
}

/**
 * EP-3: the arc's circle. null when the arc breaks the rule (chord 0, or
 * `bend` out of range). The player doesn't use it: for a nearly straight arc
 * the radius is huge (infinite at the smallest bends) and the centre loses
 * precision, so check `radius` is finite before relying on it.
 */
export function arcCircle(from: XY, to: XY, bend: number): ArcCircle | null {
	const c = hyp(from, to);
	const k = Math.abs(bend);
	if (!(c > 0) || !(k > 0) || k > 0.5) return null;
	const n: XY = [-(to[1] - from[1]) / c, (to[0] - from[0]) / c];
	const M: XY = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
	const s = bend * c;
	const radius = (c * (0.25 + k * k)) / (2 * k);
	// the centre is on the far side of the chord from the apex (or on it, at a half turn)
	const off = s - Math.sign(bend) * radius;
	const center: XY = [M[0] + off * n[0], M[1] + off * n[1]];
	const apex: XY = [M[0] + s * n[0], M[1] + s * n[1]];
	const theta = 4 * Math.atan(2 * k);
	const a = sub(from, center);
	const p = sub(apex, center);
	// the walk turns toward the apex
	const dir = a[0] * p[1] - a[1] * p[0] >= 0 ? 1 : -1;
	return {
		center,
		radius,
		startAngle: Math.atan2(a[1], a[0]),
		sweep: dir * theta,
	};
}

/**
 * `sin(h·f) / sin(h)` for `0 ≤ f ≤ 1`, kept accurate as `h` goes to 0 (where
 * both sines underflow toward 0, or below the smallest normal number).
 */
function sineRatio(h: number, f: number): number {
	if (h < 1e-4) return f * (1 + (h * h * (1 - f * f)) / 6);
	return Math.sin(h * f) / Math.sin(h);
}

/** `sin(h) / h`, kept accurate as `h` goes to 0. */
function sinOver(h: number): number {
	return h < 1e-4 ? 1 - (h * h) / 6 : Math.sin(h) / h;
}

/**
 * EP-3 played from the chord rather than the circle's centre, so a nearly
 * straight arc (a huge radius) loses no precision: the point at share `f` is
 * `c · sin(θf/2) / sin(θ/2)` from the start, in the chord's direction turned
 * toward the apex by `θ(1 − f)/2`. The length `r·θ` is `c · (θ/2) / sin(θ/2)`.
 */
function arcPiece(from: XY, to: XY, bend: number): ExactPiece | null {
	const c = hyp(from, to);
	const k = Math.abs(bend);
	if (!(c > 0) || !(k > 0) || k > 0.5) return null;
	const half = 2 * Math.atan(2 * k);
	const turn = Math.sign(bend) * half;
	const ux = (to[0] - from[0]) / c;
	const uy = (to[1] - from[1]) / c;
	return {
		kind: "arc",
		from,
		to,
		length: c / sinOver(half),
		pointAt: (f) => {
			if (f <= 0) return from;
			if (f >= 1) return to;
			const d = c * sineRatio(half, f);
			const a = turn * (1 - f);
			const cos = Math.cos(a);
			const sin = Math.sin(a);
			return [
				from[0] + d * (ux * cos - uy * sin),
				from[1] + d * (ux * sin + uy * cos),
			];
		},
	};
}

// 8-point Gauss–Legendre on [-1, 1]
const GL_X = [
	-0.9602898564975363, -0.7966664774136267, -0.525532409916329,
	-0.1834346424956498, 0.1834346424956498, 0.525532409916329,
	0.7966664774136267, 0.9602898564975363,
];
const GL_W = [
	0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362,
	0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

/** A cubic's point and true arc length at any parameter, and its parameter at any length. */
export interface CubicMeasure {
	length: number;
	point(t: number): XY;
	lengthTo(t: number): number;
	paramAt(d: number): number;
}

/** `|B'(t)|` of a cubic: B'(t) = 3[(1-t)²(c1-p0) + 2(1-t)t(c2-c1) + t²(p3-c2)]. */
function cubicSpeed(p0: XY, c1: XY, c2: XY, p3: XY): (t: number) => number {
	const ax = 3 * (c1[0] - p0[0]);
	const ay = 3 * (c1[1] - p0[1]);
	const bx = 3 * (c2[0] - c1[0]);
	const by = 3 * (c2[1] - c1[1]);
	const cx = 3 * (p3[0] - c2[0]);
	const cy = 3 * (p3[1] - c2[1]);
	return (t) => {
		const u = 1 - t;
		const x = u * u * ax + 2 * u * t * bx + t * t * cx;
		const y = u * u * ay + 2 * u * t * by + t * t * cy;
		return Math.hypot(x, y);
	};
}

/** `∫ f` over `[a, b]` by 8-point Gauss–Legendre. */
function gaussLegendre(f: (t: number) => number, a: number, b: number): number {
	const h = (b - a) / 2;
	const m = (a + b) / 2;
	let s = 0;
	for (let i = 0; i < 8; i++)
		s += (GL_W[i] as number) * f(m + h * (GL_X[i] as number));
	return s * h;
}

/** EP-4: a cubic measured by its true arc length. */
export function measureCubic(p0: XY, c1: XY, c2: XY, p3: XY): CubicMeasure {
	const speed = cubicSpeed(p0, c1, c2, p3);
	const gl = (a: number, b: number) => gaussLegendre(speed, a, b);
	const tableOf = (n: number) => {
		const cum = [0];
		for (let i = 0; i < n; i++)
			cum.push((cum[i] as number) + gl(i / n, (i + 1) / n));
		return cum;
	};
	// double the intervals until the total settles (a cusp needs more)
	let n = 16;
	let cum = tableOf(n);
	while (n < 4096) {
		const finer = tableOf(n * 2);
		const a = cum[n] as number;
		const b = finer[n * 2] as number;
		n *= 2;
		cum = finer;
		if (Math.abs(a - b) <= 1e-12 * Math.max(1, b)) break;
	}
	const length = cum[n] as number;
	const lengthTo = (t: number) => {
		if (t <= 0) return 0;
		if (t >= 1) return length;
		const k = Math.min(n - 1, Math.floor(t * n));
		return (cum[k] as number) + gl(k / n, t);
	};
	const point = (t: number): XY => {
		const u = 1 - t;
		const a = u * u * u;
		const b = 3 * u * u * t;
		const c = 3 * u * t * t;
		const d = t * t * t;
		return [
			a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
			a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
		];
	};
	const paramAt = (d: number) => {
		if (d <= 0) return 0;
		if (d >= length) return 1;
		// the interval holding d, then Newton kept inside it
		let lo = 0;
		let hi = n;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if ((cum[mid] as number) <= d) lo = mid;
			else hi = mid;
		}
		let a = lo / n;
		let b = hi / n;
		const cumLo = cum[lo] as number;
		const span = (cum[hi] as number) - cumLo;
		let t = span > 0 ? a + ((d - cumLo) / span) * (b - a) : a;
		for (let i = 0; i < 40; i++) {
			const err = lengthTo(t) - d;
			if (Math.abs(err) <= 1e-12 * Math.max(1, length)) break;
			if (err > 0) b = t;
			else a = t;
			const v = speed(t);
			let next = v > 0 ? t - err / v : (a + b) / 2;
			if (!(next > a && next < b)) next = (a + b) / 2;
			t = next;
		}
		return t;
	};
	return { length, point, lengthTo, paramAt };
}

function cubicPiece(from: XY, c1: XY, c2: XY, to: XY): ExactPiece {
	const m = measureCubic(from, c1, c2, to);
	return {
		kind: "cubic",
		from,
		to,
		length: m.length,
		pointAt: (f) =>
			f <= 0 ? from : f >= 1 ? to : m.point(m.paramAt(f * m.length)),
	};
}

/**
 * The path's pieces in order (each leg of a points shape, each arc, each
 * cubic), or null when a shape breaks EP-2 or EP-3.
 */
export function exactPieces(path: ExactPath): ExactPiece[] | null {
	const out: ExactPiece[] = [];
	let at = path.from;
	for (const shape of path.shapes) {
		switch (shape.kind) {
			case "points":
				if (shape.points.length === 0) return null;
				for (const p of shape.points) {
					out.push(linePiece(at, p));
					at = p;
				}
				break;
			case "arc": {
				const piece = arcPiece(at, shape.to, shape.bend);
				if (!piece) return null;
				out.push(piece);
				at = shape.to;
				break;
			}
			case "cubic":
				out.push(cubicPiece(at, shape.c1, shape.c2, shape.to));
				at = shape.to;
				break;
		}
	}
	return out;
}

/** The number of pieces, `N`: the last key's `u`. */
export function exactPieceCount(path: ExactPath): number {
	let n = 0;
	for (const s of path.shapes) n += s.kind === "points" ? s.points.length : 1;
	return n;
}

// ---------------------------------------------------------------------------
// Rules (EP-1 to EP-6)
// ---------------------------------------------------------------------------

const finiteXY = (p: XY) => Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** Every rule (EP-1 to EP-6) the path breaks; empty when it keeps them all. */
export function checkExactPath(path: ExactPath): ExactPathProblem[] {
	const problems: ExactPathProblem[] = [];
	const add = (
		rule: ExactPathRule,
		message: string,
		at: (string | number)[] = [],
	) => problems.push({ rule, message, path: at });
	if (path.v !== 1) add("EP-1", `version ${String(path.v)} is not 1`, ["v"]);
	let finite = finiteXY(path.from);
	for (const s of path.shapes) {
		if (s.kind === "points") finite &&= s.points.every(finiteXY);
		else if (s.kind === "arc")
			finite &&= finiteXY(s.to) && Number.isFinite(s.bend);
		else finite &&= finiteXY(s.c1) && finiteXY(s.c2) && finiteXY(s.to);
	}
	for (const k of path.keys)
		finite &&= Number.isFinite(k.tick) && Number.isFinite(k.u);
	if (!finite)
		add("EP-1", "a coordinate, bend, tick or place is not a finite number");
	if (path.shapes.length === 0)
		add("EP-2", "the path has no shapes", ["shapes"]);
	let at = path.from;
	path.shapes.forEach((s, i) => {
		if (s.kind === "points") {
			if (s.points.length === 0)
				add("EP-2", `shape ${i} has no points`, ["shapes", i, "points"]);
			else at = s.points[s.points.length - 1] as XY;
			return;
		}
		if (s.kind === "arc") {
			const k = Math.abs(s.bend);
			if (!(k > 0) || k > 0.5)
				add("EP-3", `arc ${i} has bend ${s.bend}, outside 0 < |bend| ≤ 1/2`, [
					"shapes",
					i,
					"bend",
				]);
			else if (!(hyp(at, s.to) > 0))
				add("EP-3", `arc ${i} ends where it starts`, ["shapes", i, "to"]);
		}
		at = s.to;
	});
	const N = exactPieceCount(path);
	const keys = path.keys;
	if (keys.length < 2) add("EP-5", "a path needs at least two keys", ["keys"]);
	else {
		const first = keys[0] as ExactKey;
		const last = keys[keys.length - 1] as ExactKey;
		if (first.tick !== 0 || first.u !== 0)
			add("EP-5", "the first key must be {tick: 0, u: 0}", ["keys", 0]);
		if (last.u !== N)
			add(
				"EP-5",
				`the last key's place is ${last.u}, not the piece count ${N}`,
				["keys", keys.length - 1, "u"],
			);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i] as ExactKey;
			if (!Number.isInteger(k.tick))
				add("EP-5", `key ${i}'s tick is not whole`, ["keys", i, "tick"]);
			if (k.u < 0 || k.u > N)
				add("EP-5", `key ${i}'s place is outside 0 to ${N}`, ["keys", i, "u"]);
			if (i > 0) {
				const p = keys[i - 1] as ExactKey;
				if (!(k.tick > p.tick))
					add("EP-5", `keys ${i - 1} and ${i} don't have increasing ticks`, [
						"keys",
						i,
						"tick",
					]);
				if (k.u < p.u)
					add("EP-5", `key ${i}'s place goes back`, ["keys", i, "u"]);
			}
		}
	}
	if (problems.length === 0) {
		const pieces = exactPieces(path);
		const length = pieces ? pieces.reduce((s, p) => s + p.length, 0) : 0;
		if (!(length >= EXACT_MIN_LENGTH)) add("EP-6", "the path goes nowhere");
		else if (!Number.isFinite(length))
			add("EP-6", "the path's length is not a finite number");
	}
	return problems;
}

// ---------------------------------------------------------------------------
// Reading (EP-R)
// ---------------------------------------------------------------------------

/** A path made ready to play: its pieces and their running lengths. */
export interface ExactPlayer {
	pieces: ExactPiece[];
	/** `cum[i]` is the distance where piece `i` starts; `cum[N]` the path's length */
	cum: number[];
	length: number;
	/** The distance of place `u` (EP-R step 1) */
	distanceOf(u: number): number;
	/** The place at distance `d` */
	placeAt(d: number): number;
	/** The point at place `u` */
	pointAtPlace(u: number): XY;
	/** The distance at `tick` (EP-R step 2), clamped to the keys */
	distanceAtTick(tick: number): number;
	/**
	 * EP-R: the point at `tick` (fractional ticks allowed). Outside the move
	 * it gives the nearer end; the spec says the path doesn't place the marcher
	 * there, so callers decide what happens before and after.
	 */
	pointAt(tick: number): XY;
}

/**
 * Make a path ready to play. Building one measures every piece, so keep it and
 * call `pointAt` for each frame. Throws when the path breaks a rule (see
 * {@link checkExactPath}).
 */
export function exactPlayer(path: ExactPath): ExactPlayer {
	const problems = checkExactPath(path);
	const first = problems[0];
	if (first)
		throw new Error(`exact path breaks ${first.rule}: ${first.message}`);
	const pieces = exactPieces(path) as ExactPiece[];
	const N = pieces.length;
	const cum = [0];
	for (const p of pieces) cum.push((cum[cum.length - 1] as number) + p.length);
	const length = cum[N] as number;
	const piece = (i: number) => pieces[i] as ExactPiece;
	const split = (u: number): [number, number] => {
		if (u <= 0) return [0, 0];
		if (u >= N) return [N - 1, 1];
		const i = Math.floor(u);
		return [i, u - i];
	};
	const distanceOf = (u: number) => {
		const [i, f] = split(u);
		return (cum[i] as number) + f * piece(i).length;
	};
	const placeAt = (d: number) => {
		if (d <= 0) return 0;
		if (d >= length) return N;
		let lo = 0;
		let hi = N;
		// the last piece starting at or before d, skipping pieces of length 0
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if ((cum[mid] as number) <= d) lo = mid;
			else hi = mid;
		}
		const len = piece(lo).length;
		return len > 0 ? lo + Math.min(1, (d - (cum[lo] as number)) / len) : lo;
	};
	const pointAtPlace = (u: number) => {
		const [i, f] = split(u);
		return piece(i).pointAt(f);
	};
	const keys = path.keys;
	const D = keys.map((k) => distanceOf(k.u));
	const key = (i: number) => keys[i] as ExactKey;
	const dist = (i: number) => D[i] as number;
	const distanceAtTick = (tick: number) => {
		if (tick <= 0) return dist(0);
		const last = keys.length - 1;
		if (tick >= key(last).tick) return dist(last);
		let lo = 0;
		let hi = last;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (key(mid).tick <= tick) lo = mid;
			else hi = mid;
		}
		const a = key(lo);
		const b = key(hi);
		return (
			dist(lo) + ((tick - a.tick) / (b.tick - a.tick)) * (dist(hi) - dist(lo))
		);
	};
	return {
		pieces,
		cum,
		length,
		distanceOf,
		placeAt,
		pointAtPlace,
		distanceAtTick,
		pointAt: (tick) => pointAtPlace(placeAt(distanceAtTick(tick))),
	};
}

/**
 * EP-R: where the path puts the marcher at `tick` (ticks from the move's start,
 * fractional allowed). Measures the path on every call; to play many frames,
 * build an {@link exactPlayer} once.
 */
export function exactPointAt(path: ExactPath, tick: number): XY {
	return exactPlayer(path).pointAt(tick);
}
