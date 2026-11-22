import { type ExactPlayer, exactPlayer, type XY } from "./exactPath";
import type { ExactPathEntry } from "./schema";

/** Plays a show's exact paths by marcher and show tick. */
export interface ExactPathReader {
	/**
	 * Where the marcher is at `tick` (ticks from the start of the show, 480 per
	 * beat, fractional allowed), or `undefined` when none of the marcher's exact
	 * paths covers that tick. Then the reader places the marcher as it would
	 * without exact paths: a straight line between sets. When one path ends on
	 * the tick the next starts, the next one answers.
	 */
	positionAt(marcherId: string, tick: number): XY | undefined;
}

type Placed = { entry: ExactPathEntry; player?: ExactPlayer };

/**
 * Get a show's exact paths ready to play (EP-R). Each path is measured the
 * first time it's needed, so building this is cheap. Pass validated data: a
 * path that breaks a rule throws when it's first played.
 */
export function createExactPathReader(
	entries: readonly ExactPathEntry[],
): ExactPathReader {
	const byMarcher = new Map<string, Placed[]>();
	for (const entry of entries) {
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
			const placed = list[lo - 1];
			if (!placed || tick > placed.entry.endTick) return undefined;
			placed.player ??= exactPlayer(placed.entry.path);
			return placed.player.pointAt(tick - placed.entry.startTick);
		},
	};
}
