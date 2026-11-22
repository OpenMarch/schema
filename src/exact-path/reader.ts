import {
	type ExactPlayer,
	exactPlayer,
	TICKS_PER_BEAT,
	type XY,
} from "./exactPath";
import type { ExactPathEntry } from "./schema";

/** What {@link createExactPathReader} needs from a show. */
export interface ExactPathShow {
	pages: readonly { startBeatIndex: number }[];
	exactPaths?: readonly ExactPathEntry[] | undefined;
}

/** Plays a show's exact paths by marcher and show tick. */
export interface ExactPathReader {
	/**
	 * Where the marcher is at `tick` (ticks from the start of the show, 480 per
	 * beat, fractional allowed), or `undefined` when the page holding that tick
	 * has no exact path for the marcher. Then the reader places the marcher as
	 * it would without exact paths: a straight line between sets.
	 *
	 * In a page that does have one, the marcher follows its exact paths and
	 * stands still on the counts they don't cover: at the end of the path
	 * before, or, before the page's first path, at that path's start. When one
	 * path ends on the tick the next starts, the next one answers.
	 */
	positionAt(marcherId: string, tick: number): XY | undefined;
}

type Placed = { entry: ExactPathEntry; player?: ExactPlayer };

const play = (placed: Placed, tick: number): XY => {
	placed.player ??= exactPlayer(placed.entry.path);
	return placed.player.pointAt(tick - placed.entry.startTick);
};

/**
 * Get a show's exact paths ready to play (EP-R). Pages are the walks into each
 * set: a page runs from its `startBeatIndex` to the next page's (the last page
 * runs on to the end of the show). Pages are taken in `startBeatIndex` order,
 * whatever their order in the list. Ticks before the first page, or a show with
 * no pages, count as one more page. Each path is measured the first time it's
 * needed, so building this is cheap. Pass validated data: a path that breaks a
 * rule throws when it's first played.
 */
export function createExactPathReader(show: ExactPathShow): ExactPathReader {
	const pageStarts = show.pages
		.map((p) => p.startBeatIndex * TICKS_PER_BEAT)
		.sort((a, b) => a - b);
	/** The page holding `tick`: [start, end), the last one open-ended */
	const pageAround = (tick: number): [number, number] => {
		let lo = 0;
		let hi = pageStarts.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if ((pageStarts[mid] as number) <= tick) lo = mid + 1;
			else hi = mid;
		}
		const start = pageStarts[lo - 1] ?? Number.NEGATIVE_INFINITY;
		return [start, pageStarts[lo] ?? Number.POSITIVE_INFINITY];
	};
	const byMarcher = new Map<string, Placed[]>();
	for (const entry of show.exactPaths ?? []) {
		const list = byMarcher.get(entry.marcherId);
		if (list) list.push({ entry });
		else byMarcher.set(entry.marcherId, [{ entry }]);
	}
	for (const list of byMarcher.values())
		list.sort((a, b) => a.entry.startTick - b.entry.startTick);
	return {
		positionAt(marcherId, tick) {
			const list = byMarcher.get(marcherId);
			if (!list) return undefined;
			// the last path starting at or before the tick
			let lo = 0;
			let hi = list.length;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if ((list[mid] as Placed).entry.startTick <= tick) lo = mid + 1;
				else hi = mid;
			}
			const before = list[lo - 1];
			if (before && tick <= before.entry.endTick) return play(before, tick);
			// not on a path: stand still if this page has a path for the marcher
			const [pageStart, pageEnd] = pageAround(tick);
			// (a path ending on the page's first tick belongs to the page before)
			if (before && before.entry.endTick > pageStart)
				return play(before, before.entry.endTick);
			const after = list[lo];
			if (after && after.entry.startTick < pageEnd)
				return play(after, after.entry.startTick);
			return undefined;
		},
	};
}
