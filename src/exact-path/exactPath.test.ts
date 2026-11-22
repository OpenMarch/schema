/**
 * Exact paths, the format (OpenMarch ADR 0018, timeline spec Appendix M):
 * each shape, keys, the ends, and the spec's QA cases that need no app
 * (QA-EP-1 to QA-EP-5; QA-EP-3c and 3d test retime and split, which stay in
 * OpenMarch, and QA-EP-6 to 8 test its converter).
 */
import { describe, expect, it } from "bun:test";
import parity from "./fixtures/core-parity.json";
import {
	checkExactPath,
	type ExactPath,
	exactPieceCount,
	exactPlayer,
	exactPointAt,
	measureCubic,
	type XY,
} from "./index";

const d2 = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rules = (p: ExactPath) => [
	...new Set(checkExactPath(p).map((x) => x.rule)),
];

/** A cubic's length by many chords, as an independent check. */
function chordLength(p0: XY, c1: XY, c2: XY, p3: XY, n = 1_000_000): number {
	const m = measureCubic(p0, c1, c2, p3);
	let total = 0;
	let prev = p0;
	for (let i = 1; i <= n; i++) {
		const p = m.point(i / n);
		total += d2(prev, p);
		prev = p;
	}
	return total;
}

const corner: ExactPath = {
	v: 1,
	from: [0, 0],
	shapes: [
		{
			kind: "points",
			points: [
				[12, 0],
				[12, 12],
			],
		},
	],
	keys: [
		{ tick: 0, u: 0 },
		{ tick: 2880, u: 1 },
		{ tick: 3840, u: 2 },
	],
};

describe("pieces", () => {
	it("a straight piece walks at a steady speed", () => {
		const path: ExactPath = {
			v: 1,
			from: [2, 3],
			shapes: [{ kind: "points", points: [[14, 19]] }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 1920, u: 1 },
			],
		};
		const player = exactPlayer(path);
		expect(player.length).toBe(20);
		for (let tick = 0; tick <= 1920; tick += 120) {
			const f = tick / 1920;
			expect(d2(player.pointAt(tick), [2 + 12 * f, 3 + 16 * f])).toBeLessThan(
				1e-12,
			);
		}
	});

	it("an arc bows toward +90° from its chord, and walks by angle", () => {
		// chord along +x, so the apex is toward +y: a half circle of radius 5
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [{ kind: "arc", to: [10, 0], bend: 0.5 }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 960, u: 1 },
			],
		};
		const player = exactPlayer(path);
		expect(player.length).toBeCloseTo(5 * Math.PI, 12);
		expect(d2(player.pointAt(480), [5, 5])).toBeLessThan(1e-12);
		for (let tick = 0; tick <= 960; tick += 60) {
			const a = Math.PI - (tick / 960) * Math.PI;
			const want: XY = [5 + 5 * Math.cos(a), 5 * Math.sin(a)];
			expect(d2(player.pointAt(tick), want)).toBeLessThan(1e-9);
		}
		// a negative bend bows the other way
		const flipped = exactPlayer({
			...path,
			shapes: [{ kind: "arc", to: [10, 0], bend: -0.5 }],
		});
		expect(d2(flipped.pointAt(480), [5, -5])).toBeLessThan(1e-12);
	});

	it("flipping y and negating bend mirrors an arc exactly", () => {
		const up: ExactPath = {
			v: 1,
			from: [3, 7],
			shapes: [{ kind: "arc", to: [15, 2], bend: 0.3 }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 960, u: 1 },
			],
		};
		const down: ExactPath = {
			...up,
			from: [3, -7],
			shapes: [{ kind: "arc", to: [15, -2], bend: -0.3 }],
		};
		for (let tick = 0; tick <= 960; tick += 80) {
			const a = exactPointAt(up, tick);
			const b = exactPointAt(down, tick);
			expect(d2(a, [b[0], -b[1]])).toBeLessThan(1e-9);
		}
	});

	it("a cubic is timed by its true length, not by its parameter", () => {
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [{ kind: "cubic", c1: [0, 30], c2: [40, 30], to: [40, 0] }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 480, u: 1 },
			],
		};
		const m = measureCubic([0, 0], [0, 30], [40, 30], [40, 0]);
		const ref = chordLength([0, 0], [0, 30], [40, 30], [40, 0]);
		expect(Math.abs(m.length - ref) / ref).toBeLessThan(1e-6);
		// symmetric curve: halfway in time is its midpoint
		expect(d2(exactPointAt(path, 240), m.point(0.5))).toBeLessThan(1e-9);
	});
});

describe("keys", () => {
	it("several keys: steady speed between each pair, holds where u repeats", () => {
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [
				{
					kind: "points",
					points: [
						[10, 0],
						[10, 10],
					],
				},
			],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 480, u: 1 }, // fast: 10 steps in a beat
				{ tick: 960, u: 1 }, // hold on the corner for a beat
				{ tick: 2880, u: 2 }, // slow: 10 steps in 4 beats
			],
		};
		const p = exactPlayer(path);
		expect(d2(p.pointAt(240), [5, 0])).toBeLessThan(1e-12);
		expect(p.pointAt(480)).toEqual([10, 0]);
		expect(p.pointAt(700)).toEqual([10, 0]);
		expect(p.pointAt(960)).toEqual([10, 0]);
		expect(d2(p.pointAt(1440), [10, 2.5])).toBeLessThan(1e-12);
		expect(d2(p.pointAt(1440.5), [10, 2.5 + 10 / 3840])).toBeLessThan(1e-12);
	});

	it("a key on a joint lands exactly on the corner", () => {
		expect(exactPointAt(corner, 2880)).toEqual([12, 0]);
	});
});

describe("ends", () => {
	const path: ExactPath = {
		v: 1,
		from: [-3, 4],
		shapes: [
			{ kind: "cubic", c1: [0, 10], c2: [10, 10], to: [10, 0] },
			{ kind: "arc", to: [20, 0], bend: -0.25 },
			{ kind: "points", points: [[25, 6]] },
		],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 777, u: 1.4 },
			{ tick: 1920, u: 3 },
		],
	};

	it("tick 0 is the start and the last tick is the end, exactly", () => {
		expect(exactPointAt(path, 0)).toEqual([-3, 4]);
		expect(exactPointAt(path, 1920)).toEqual([25, 6]);
	});

	it("outside the move it stays clamped to the ends", () => {
		expect(exactPointAt(path, -10)).toEqual([-3, 4]);
		expect(exactPointAt(path, 5000)).toEqual([25, 6]);
	});
});

describe("Appendix M QA", () => {
	it("QA-EP-1: lengths of each shape, and the shape ends", () => {
		const quarter = (Math.SQRT2 - 1) / 2;
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [
				{
					kind: "points",
					points: [
						[3, 4],
						[3, 10],
						[6, 14],
					],
				},
				{ kind: "arc", to: [16, 24], bend: quarter },
				{ kind: "cubic", c1: [20, 40], c2: [40, 0], to: [50, 24] },
			],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 4800, u: 5 },
			],
		};
		expect(checkExactPath(path)).toEqual([]);
		expect(exactPieceCount(path)).toBe(5);
		const player = exactPlayer(path);
		const [l1, l2, l3, arc, cubic] = player.pieces.map((p) => p.length);
		expect(l1).toBeCloseTo(5, 12);
		expect(l2).toBeCloseTo(6, 12);
		expect(l3).toBeCloseTo(5, 12);
		// a quarter turn on chord √200: radius 10, length 5π
		expect(arc).toBeCloseTo(5 * Math.PI, 10);
		const ref = chordLength([16, 24], [20, 40], [40, 0], [50, 24]);
		expect(Math.abs((cubic as number) - ref) / ref).toBeLessThan(1e-6);
		// every joint is where its shape ends
		expect(d2(player.pointAtPlace(3), [6, 14])).toBeLessThan(1e-12);
		expect(d2(player.pointAtPlace(4), [16, 24])).toBeLessThan(1e-9);
		expect(d2(exactPointAt(path, 4800), [50, 24])).toBeLessThan(1e-12);
		expect(d2(exactPointAt(path, 0), [0, 0])).toBeLessThan(1e-12);
		// the arc's middle is its apex: M + bend·c·n
		const apex: XY = [
			11 - quarter * 10 * Math.SQRT2 * Math.SQRT1_2,
			19 + quarter * 10,
		];
		expect(d2(player.pointAtPlace(3.5), apex)).toBeLessThan(1e-9);
	});

	it("QA-EP-2: equal ticks walk equal distances along a peaked cubic", () => {
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [{ kind: "cubic", c1: [0, 80], c2: [10, 80], to: [10, 0] }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 960, u: 1 },
			],
		};
		const player = exactPlayer(path);
		const m = measureCubic([0, 0], [0, 80], [10, 80], [10, 0]);
		for (let tick = 0; tick <= 960; tick += 40) {
			const p = player.pointAt(tick);
			// the length from the start to that point, measured independently
			let t = 0;
			let best = Number.POSITIVE_INFINITY;
			for (let i = 0; i <= 20000; i++) {
				const e = d2(p, m.point(i / 20000));
				if (e < best) {
					best = e;
					t = i / 20000;
				}
			}
			expect(Math.abs(m.lengthTo(t) - (tick / 960) * m.length)).toBeLessThan(
				1e-6 * m.length + 0.01,
			);
		}
		// and not equal steps of t: a quarter of the time is not t = 1/4
		expect(d2(player.pointAt(240), m.point(0.25))).toBeGreaterThan(1);
	});

	it("QA-EP-3: a hold, then a steady walk", () => {
		const path: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [{ kind: "points", points: [[20, 0]] }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 960, u: 0 },
				{ tick: 1920, u: 1 },
			],
		};
		expect(exactPointAt(path, 500)).toEqual([0, 0]);
		expect(exactPointAt(path, 960)).toEqual([0, 0]);
		expect(d2(exactPointAt(path, 1440), [10, 0])).toBeLessThan(1e-12);
		expect(d2(exactPointAt(path, 1200), [5, 0])).toBeLessThan(1e-12);
	});

	it("QA-EP-3b: keys on a corner keep their count when either end moves", () => {
		// the end moved to (12, 18), then the start to (−6, 0), keys unchanged
		const endMoved: ExactPath = {
			...corner,
			shapes: [
				{
					kind: "points",
					points: [
						[12, 0],
						[12, 18],
					],
				},
			],
		};
		const both: ExactPath = { ...endMoved, from: [-6, 0] };
		for (const p of [corner, endMoved, both]) {
			expect(checkExactPath(p)).toEqual([]);
			expect(d2(exactPointAt(p, 2880), [12, 0])).toBeLessThan(1e-12);
		}
		expect(exactPointAt(both, 0)).toEqual([-6, 0]);
		expect(exactPointAt(both, 3840)).toEqual([12, 18]);
	});

	it("QA-EP-4: each broken rule is refused with its id", () => {
		expect(rules(corner)).toEqual([]);
		expect(rules({ ...corner, from: [Number.NaN, 0] })).toEqual(["EP-1"]);
		expect(rules({ ...corner, v: 2 as 1 })).toEqual(["EP-1"]);
		expect(rules({ ...corner, shapes: [] })).toContain("EP-2");
		expect(
			rules({ ...corner, shapes: [{ kind: "points", points: [] }] }),
		).toContain("EP-2");
		const arc = (bend: number, to: XY = [10, 0]): ExactPath => ({
			v: 1,
			from: [0, 0],
			shapes: [{ kind: "arc", to, bend }],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 10, u: 1 },
			],
		});
		expect(rules(arc(0.25))).toEqual([]);
		expect(rules(arc(0))).toEqual(["EP-3"]);
		expect(rules(arc(0.6))).toEqual(["EP-3"]);
		expect(rules(arc(0.25, [0, 0]))).toEqual(["EP-3"]);
		const keys = (k: ExactPath["keys"]) => rules({ ...corner, keys: k });
		// first key not 0
		expect(
			keys([
				{ tick: 5, u: 0 },
				{ tick: 10, u: 2 },
			]),
		).toEqual(["EP-5"]);
		// two keys on one tick
		expect(
			keys([
				{ tick: 0, u: 0 },
				{ tick: 10, u: 1 },
				{ tick: 10, u: 1.5 },
				{ tick: 20, u: 2 },
			]),
		).toEqual(["EP-5"]);
		// u going back
		expect(
			keys([
				{ tick: 0, u: 0 },
				{ tick: 10, u: 1.5 },
				{ tick: 15, u: 1 },
				{ tick: 20, u: 2 },
			]),
		).toEqual(["EP-5"]);
		// last u ≠ N
		expect(
			keys([
				{ tick: 0, u: 0 },
				{ tick: 10, u: 1 },
			]),
		).toEqual(["EP-5"]);
		// ticks not whole
		expect(
			keys([
				{ tick: 0, u: 0 },
				{ tick: 10.5, u: 2 },
			]),
		).toEqual(["EP-5"]);
		// fewer than two keys
		expect(keys([{ tick: 0, u: 0 }])).toEqual(["EP-5"]);
		expect(
			rules({
				v: 1,
				from: [3, 3],
				shapes: [{ kind: "points", points: [[3, 3]] }],
				keys: [
					{ tick: 0, u: 0 },
					{ tick: 10, u: 1 },
				],
			}),
		).toEqual(["EP-6"]);
		// a player refuses a broken path, naming the rule
		expect(() => exactPlayer(arc(0))).toThrow("EP-3");
	});

	it("QA-EP-4: each problem says where in the path it is", () => {
		const problems = checkExactPath({
			...corner,
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 10, u: 1.5 },
				{ tick: 10, u: 2 },
			],
		});
		expect(problems).toEqual([
			{
				rule: "EP-5",
				message: "keys 1 and 2 don't have increasing ticks",
				path: ["keys", 2, "tick"],
			},
		]);
	});

	it("QA-EP-5: with an end moved, a key on the joint before it keeps its count", () => {
		// the spec's path with both ends moved as EP-F says: the cubic's c1 moved
		// with its start, the arc's end moved with its bend kept; keys unchanged
		const before: ExactPath = {
			v: 1,
			from: [0, 0],
			shapes: [
				{ kind: "cubic", c1: [0, 10], c2: [10, 10], to: [10, 0] },
				{ kind: "points", points: [[20, 0]] },
				{ kind: "arc", to: [30, 0], bend: 0.25 },
			],
			keys: [
				{ tick: 0, u: 0 },
				{ tick: 480, u: 2 },
				{ tick: 960, u: 3 },
			],
		};
		const moved: ExactPath = {
			...before,
			from: [-2, 1],
			shapes: [
				{ kind: "cubic", c1: [-2, 11], c2: [10, 10], to: [10, 0] },
				{ kind: "points", points: [[20, 0]] },
				{ kind: "arc", to: [34, 3], bend: 0.25 },
			],
		};
		expect(checkExactPath(moved)).toEqual([]);
		expect(d2(exactPointAt(before, 480), [20, 0])).toBeLessThan(1e-12);
		expect(d2(exactPointAt(moved, 480), [20, 0])).toBeLessThan(1e-12);
		expect(exactPointAt(moved, 0)).toEqual([-2, 1]);
		expect(exactPointAt(moved, 960)).toEqual([34, 3]);
	});
});

describe("same answers as OpenMarch's packages/core", () => {
	it(`matches exactPointAt on ${parity.cases.length} shared paths`, () => {
		expect(parity.cases.length).toBeGreaterThan(10);
		for (const c of parity.cases) {
			const path = c.path as unknown as ExactPath;
			expect(checkExactPath(path)).toEqual([]);
			const player = exactPlayer(path);
			for (const [tick, x, y] of c.samples as [number, number, number][]) {
				const got = player.pointAt(tick);
				if (d2(got, [x, y]) > 1e-12)
					throw new Error(`${c.name} at tick ${tick}: ${got} vs ${[x, y]}`);
			}
		}
	});
});
