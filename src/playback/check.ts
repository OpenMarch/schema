import type { z } from "zod";
import type { OpenMarchPlaybackShapeSchema } from "./schema";

type PlaybackShape = z.output<typeof OpenMarchPlaybackShapeSchema>;

/**
 * Stable code for each kind of problem. Match on these, not on messages:
 * messages are for people and may be reworded. New codes may be added in any
 * release, so handle codes you don't know (don't rely on an exhaustive switch).
 */
export type PlaybackIssueCode =
	| "file.corrupt"
	| "json.invalid"
	| "version.unsupported"
	| "shape"
	| "path.invalid"
	| "move.lengthMismatch"
	| "performer.duplicateId"
	| "page.duplicateId"
	| "page.firstNotAtZero"
	| "page.notChained"
	| "page.noCounts"
	| "page.pastShowEnd"
	| "page.firstHasPaths"
	| "path.unknownMarcher"
	| "path.startMismatch"
	| "path.endMismatch"
	| "measure.outsideShow"
	| "measure.outOfOrder"
	| "appearance.unknownMarcher"
	| "appearance.unknownPage"
	| "move.unknownMarcher"
	| "move.tickBackward"
	| "move.jumpWithinTick"
	| "coverage.noMoves"
	| "coverage.lateStart"
	| "coverage.outOfOrder"
	| "coverage.gap"
	| "coverage.overlap"
	| "coverage.jump"
	| "coverage.earlyOrLateEnd"
	| "point.missingAtPage"
	| "hold.firstSet"
	| "hold.afterLastSet"
	| "truncated";

export type PlaybackIssue = {
	code: PlaybackIssueCode;
	/** Where in the file, e.g. `["moves", 12, "ticks", 0]`; empty for the whole file */
	path: (string | number)[];
	message: string;
	/** The marcher the problem is about, when there is one */
	marcherId?: string;
};

/** Most problems reported for one file, so a badly broken file stays readable. */
export const MAX_PLAYBACK_ISSUES = 100;

/**
 * Most problems of one code reported, so one systematic exporter bug can't
 * fill the list and hide every other kind of problem.
 */
export const MAX_PLAYBACK_ISSUES_PER_CODE = 10;

/** How far a drawing's ends may be from the marcher's points, in steps (straight-line distance). */
export const PLAYBACK_PATH_END_TOLERANCE = 0.02;

type XY = readonly [number, number];

const samePosition = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];

const pointAt = (xy: number[], i: number): XY => [
	xy[2 * i] as number,
	xy[2 * i + 1] as number,
];

/** First and last points of a path string that already passed the path regex. */
function pathEnds(path: string): [XY, XY] {
	const t = path.split(" ");
	const n = t.length;
	return [
		[Number(t[1]), Number(t[2])],
		[Number(t[n - 2]), Number(t[n - 1])],
	];
}

/**
 * Collects issues: at most {@link MAX_PLAYBACK_ISSUES_PER_CODE} of each code
 * and {@link MAX_PLAYBACK_ISSUES} in all, then one line counting the rest.
 */
export class PlaybackIssueList {
	readonly issues: PlaybackIssue[] = [];
	private dropped = 0;
	private readonly perCode = new Map<PlaybackIssueCode, number>();

	add(issue: PlaybackIssue): void {
		const count = this.perCode.get(issue.code) ?? 0;
		if (
			this.issues.length < MAX_PLAYBACK_ISSUES &&
			count < MAX_PLAYBACK_ISSUES_PER_CODE
		) {
			this.issues.push(issue);
			this.perCode.set(issue.code, count + 1);
		} else {
			this.dropped++;
		}
	}

	finish(): PlaybackIssue[] {
		if (this.dropped > 0) {
			this.issues.push({
				code: "truncated",
				path: [],
				message: `…and ${this.dropped} more problems`,
			});
			this.dropped = 0;
		}
		return this.issues;
	}
}

/**
 * Every rule an `.ompb` file must follow beyond its shape (and version).
 * Only call this on data that already matches the shape: it relies on it.
 */
export function findRuleIssues(data: PlaybackShape): PlaybackIssue[] {
	const list = new PlaybackIssueList();
	const report = (
		code: PlaybackIssueCode,
		path: PlaybackIssue["path"],
		message: string,
		marcherId?: string,
	) =>
		list.add(
			marcherId === undefined
				? { code, path, message }
				: { code, path, message, marcherId },
		);

	const T = data.ticksPerBeat;
	const totalBeats = data.tempoSections.reduce(
		(sum, s) => sum + s.numberOfBeats,
		0,
	);
	const showEndTick = totalBeats * T;

	// Performers ---------------------------------------------------------------
	const performerIds = new Set<string>();
	data.performers.forEach((p, i) => {
		if (performerIds.has(p.id)) {
			report(
				"performer.duplicateId",
				["performers", i, "id"],
				`Performer ID "${p.id}" is used twice`,
				p.id,
			);
		}
		performerIds.add(p.id);
	});

	// Pages --------------------------------------------------------------------
	const pageIds = new Set<string>();
	data.pages.forEach((page, i) => {
		if (pageIds.has(page.id)) {
			report(
				"page.duplicateId",
				["pages", i, "id"],
				`Page ID "${page.id}" is used twice`,
			);
		}
		pageIds.add(page.id);

		if (i === 0) {
			if (page.startBeatIndex !== 0) {
				report(
					"page.firstNotAtZero",
					["pages", 0, "startBeatIndex"],
					`The first page must start at beat 0, not ${page.startBeatIndex}`,
				);
			}
			for (const marcherId of Object.keys(page.paths)) {
				report(
					"page.firstHasPaths",
					["pages", 0, "paths", marcherId],
					"The first page has no paths: marchers start on set 1, they don't walk to it",
					marcherId,
				);
			}
		} else {
			const prev = data.pages[i - 1] as (typeof data.pages)[number];
			const prevEnd = prev.startBeatIndex + prev.counts;
			if (page.startBeatIndex !== prevEnd) {
				report(
					"page.notChained",
					["pages", i, "startBeatIndex"],
					`Page "${page.id}" starts at beat ${page.startBeatIndex}, but the previous page ends at beat ${prevEnd}`,
				);
			}
			if (page.counts < 1) {
				report(
					"page.noCounts",
					["pages", i, "counts"],
					`Page "${page.id}" must have at least 1 count (only the first page may have 0)`,
				);
			}
		}

		for (const marcherId of Object.keys(page.paths)) {
			if (!performerIds.has(marcherId)) {
				report(
					"path.unknownMarcher",
					["pages", i, "paths", marcherId],
					`Drawing for unknown marcher "${marcherId}"`,
					marcherId,
				);
			}
		}
	});

	const firstPage = data.pages[0] as (typeof data.pages)[number];
	const firstPageEndTick = (firstPage.startBeatIndex + firstPage.counts) * T;
	const lastPage = data.pages[data.pages.length - 1] as (typeof data.pages)[0];
	const lastPageEndBeat = lastPage.startBeatIndex + lastPage.counts;
	if (lastPageEndBeat > totalBeats) {
		report(
			"page.pastShowEnd",
			["pages", data.pages.length - 1, "counts"],
			`The last page ends at beat ${lastPageEndBeat}, after the show ends at beat ${totalBeats}`,
		);
	}
	const lastPageEndTick = lastPageEndBeat * T;

	// Ticks where every marcher must have a point: each page's start and end.
	const boundaryTicks = new Set<number>();
	for (const page of data.pages) {
		const start = page.startBeatIndex * T;
		const end = (page.startBeatIndex + page.counts) * T;
		if (start <= showEndTick) boundaryTicks.add(start);
		if (end <= showEndTick) boundaryTicks.add(end);
	}

	// Measures -----------------------------------------------------------------
	data.measures?.forEach((m, i) => {
		if (m.startBeatIndex >= totalBeats) {
			report(
				"measure.outsideShow",
				["measures", i, "startBeatIndex"],
				`Measure "${m.name}" starts at beat ${m.startBeatIndex}, outside the show (beats 0 to ${totalBeats - 1})`,
			);
		}
		const prev = data.measures?.[i - 1];
		if (prev && m.startBeatIndex <= prev.startBeatIndex) {
			report(
				"measure.outOfOrder",
				["measures", i, "startBeatIndex"],
				`Measure "${m.name}" starts at beat ${m.startBeatIndex}, not after the previous measure (beat ${prev.startBeatIndex}); measures are listed in order and each has at least 1 beat`,
			);
		}
	});

	// Appearance ---------------------------------------------------------------
	data.performerAppearance?.performers?.forEach((a, i) => {
		if (!performerIds.has(a.marcherId)) {
			report(
				"appearance.unknownMarcher",
				["performerAppearance", "performers", i, "marcherId"],
				`Appearance for unknown marcher "${a.marcherId}"`,
				a.marcherId,
			);
		}
		if (!pageIds.has(a.pageId)) {
			report(
				"appearance.unknownPage",
				["performerAppearance", "performers", i, "pageId"],
				`Appearance on unknown page "${a.pageId}"`,
				a.marcherId,
			);
		}
	});

	// Moves: each move on its own ---------------------------------------------
	const movesByMarcher = new Map<string, number[]>();
	data.moves.forEach((move, mi) => {
		if (!performerIds.has(move.marcherId)) {
			report(
				"move.unknownMarcher",
				["moves", mi, "marcherId"],
				`Move for unknown marcher "${move.marcherId}"`,
				move.marcherId,
			);
			return;
		}
		const list = movesByMarcher.get(move.marcherId);
		if (list) list.push(mi);
		else movesByMarcher.set(move.marcherId, [mi]);

		for (let j = 1; j < move.ticks.length; j++) {
			const prevTick = move.ticks[j - 1] as number;
			const tick = move.ticks[j] as number;
			if (tick < prevTick) {
				report(
					"move.tickBackward",
					["moves", mi, "ticks", j],
					`Tick ${tick} comes after tick ${prevTick}; ticks must never go backward`,
					move.marcherId,
				);
			} else if (
				tick === prevTick &&
				!samePosition(pointAt(move.xy, j - 1), pointAt(move.xy, j))
			) {
				report(
					"move.jumpWithinTick",
					["moves", mi, "xy", 2 * j],
					`Two different positions at tick ${tick} would be a jump`,
					move.marcherId,
				);
			}
		}
	});

	// Moves: each marcher's whole show -----------------------------------------
	/** Marcher ID → position at each page start/end tick, for valid marchers. */
	const positionsAtBoundaries = new Map<string, Map<number, XY>>();

	for (const performer of data.performers) {
		const id = performer.id;
		const moveIndexes = movesByMarcher.get(id);
		if (!moveIndexes) {
			report(
				"coverage.noMoves",
				["moves"],
				`Marcher "${id}" has no moves; every marcher needs moves from tick 0 to the end of the show (tick ${showEndTick})`,
				id,
			);
			continue;
		}

		let timelineOk = true;
		for (let k = 0; k < moveIndexes.length; k++) {
			const mi = moveIndexes[k] as number;
			const move = data.moves[mi] as (typeof data.moves)[number];
			const first = move.ticks[0] as number;

			if (k === 0) {
				if (first !== 0) {
					report(
						"coverage.lateStart",
						["moves", mi, "ticks", 0],
						`Marcher "${id}"'s first move starts at tick ${first}, not 0`,
						id,
					);
					timelineOk = false;
				}
				continue;
			}

			const pi = moveIndexes[k - 1] as number;
			const prev = data.moves[pi] as (typeof data.moves)[number];
			const prevFirst = prev.ticks[0] as number;
			const prevLast = prev.ticks[prev.ticks.length - 1] as number;
			const where = ["moves", mi, "ticks", 0];

			if (first < prevFirst) {
				report(
					"coverage.outOfOrder",
					where,
					`Marcher "${id}"'s moves are not listed in time order (move ${mi} starts at tick ${first}, before move ${pi} at tick ${prevFirst})`,
					id,
				);
				timelineOk = false;
			} else if (first > prevLast) {
				report(
					"coverage.gap",
					where,
					`Marcher "${id}" has a gap: move ${pi} ends at tick ${prevLast}, move ${mi} starts at tick ${first}`,
					id,
				);
				timelineOk = false;
			} else if (first < prevLast) {
				report(
					"coverage.overlap",
					where,
					`Marcher "${id}" has an overlap: move ${pi} ends at tick ${prevLast}, move ${mi} starts at tick ${first}`,
					id,
				);
				timelineOk = false;
			} else if (
				!samePosition(
					pointAt(prev.xy, prev.ticks.length - 1),
					pointAt(move.xy, 0),
				)
			) {
				report(
					"coverage.jump",
					["moves", mi, "xy", 0],
					`Marcher "${id}" jumps at tick ${first}: move ${mi} doesn't start where move ${pi} ended`,
					id,
				);
				timelineOk = false;
			}
		}

		const lastIndex = moveIndexes[moveIndexes.length - 1] as number;
		const lastMove = data.moves[lastIndex] as (typeof data.moves)[number];
		const lastTick = lastMove.ticks[lastMove.ticks.length - 1] as number;
		if (lastTick !== showEndTick) {
			report(
				"coverage.earlyOrLateEnd",
				["moves", lastIndex, "ticks", lastMove.ticks.length - 1],
				`Marcher "${id}"'s last move ends at tick ${lastTick}, but the show ends at tick ${showEndTick}`,
				id,
			);
			timelineOk = false;
		}

		// Positions are only well defined once the moves fit end to end.
		if (!timelineOk) continue;

		const atBoundaries = new Map<number, XY>();
		const firstMove = data.moves[
			moveIndexes[0] as number
		] as (typeof data.moves)[number];
		const startPosition = pointAt(firstMove.xy, 0);
		let holdPosition: XY | undefined;
		// Each hold rule is reported once per marcher, at the first point that moves.
		let firstSetReported = false;
		let lastSetReported = false;
		for (const mi of moveIndexes) {
			const move = data.moves[mi] as (typeof data.moves)[number];
			for (let j = 0; j < move.ticks.length; j++) {
				const tick = move.ticks[j] as number;
				const xy = pointAt(move.xy, j);
				if (boundaryTicks.has(tick)) atBoundaries.set(tick, xy);

				// Counts before set 2's walk belong to set 1: marchers hold on it.
				if (
					!firstSetReported &&
					tick <= firstPageEndTick &&
					!samePosition(startPosition, xy)
				) {
					firstSetReported = true;
					report(
						"hold.firstSet",
						["moves", mi, "xy", 2 * j],
						`Marcher "${id}" moves at tick ${tick}, during set 1's counts (to tick ${firstPageEndTick}); they must hold on set 1`,
						id,
					);
				}

				if (tick === lastPageEndTick && holdPosition === undefined) {
					holdPosition = xy;
				}
				if (
					!lastSetReported &&
					holdPosition !== undefined &&
					tick >= lastPageEndTick &&
					!samePosition(holdPosition, xy)
				) {
					lastSetReported = true;
					report(
						"hold.afterLastSet",
						["moves", mi, "xy", 2 * j],
						`Marcher "${id}" moves at tick ${tick}, after the last set (tick ${lastPageEndTick}); they must stay put to the end of the show`,
						id,
					);
				}
			}
		}

		for (const tick of boundaryTicks) {
			if (!atBoundaries.has(tick)) {
				report(
					"point.missingAtPage",
					["moves"],
					`Marcher "${id}" has no point at tick ${tick}, where a page starts or ends`,
					id,
				);
			}
		}
		positionsAtBoundaries.set(id, atBoundaries);
	}

	// Drawings' ends -----------------------------------------------------------
	const tolerance = PLAYBACK_PATH_END_TOLERANCE + 1e-9;
	data.pages.forEach((page, i) => {
		const startTick = page.startBeatIndex * T;
		const endTick = (page.startBeatIndex + page.counts) * T;
		for (const [marcherId, path] of Object.entries(page.paths)) {
			const positions = positionsAtBoundaries.get(marcherId);
			const from = positions?.get(startTick);
			const to = positions?.get(endTick);
			if (!from || !to) continue; // already reported above
			const [drawStart, drawEnd] = pathEnds(path);
			const where = ["pages", i, "paths", marcherId];
			if (
				Math.hypot(drawStart[0] - from[0], drawStart[1] - from[1]) > tolerance
			) {
				report(
					"path.startMismatch",
					where,
					`Drawing starts at (${drawStart[0]}, ${drawStart[1]}), but marcher "${marcherId}" is at (${from[0]}, ${from[1]}) when page "${page.id}" starts`,
					marcherId,
				);
			}
			if (Math.hypot(drawEnd[0] - to[0], drawEnd[1] - to[1]) > tolerance) {
				report(
					"path.endMismatch",
					where,
					`Drawing ends at (${drawEnd[0]}, ${drawEnd[1]}), but marcher "${marcherId}" is at (${to[0]}, ${to[1]}) when page "${page.id}" ends`,
					marcherId,
				);
			}
		}
	});

	return list.finish();
}

/**
 * Zod `.check()` adapter for {@link findRuleIssues}, so `OpenMarchPlaybackSchema`
 * enforces the rules too. Each Zod issue carries the playback code and marcher
 * in `params`.
 *
 * Zod still runs object-level checks after some inner checks fail (a too-short
 * array, a failed `.refine`), so this skips the rules unless the shape is
 * fully valid: they rely on it.
 */
export function checkPlaybackData(
	payload: z.core.ParsePayload<PlaybackShape>,
): void {
	if (payload.issues.length > 0) return;
	for (const issue of findRuleIssues(payload.value)) {
		payload.issues.push({
			code: "custom",
			path: issue.path,
			message: issue.message,
			input: payload.value,
			params: { playbackCode: issue.code, marcherId: issue.marcherId },
		});
	}
}
