import { z } from "zod";
import {
	checkExactPath,
	type ExactPath,
	type ExactPathRule,
} from "./exactPath";

/** The id of a rule a show's `exactPaths` list must keep, beyond each path's own. */
export type ExactPathPlacementRule = "EP-P1" | "EP-P2" | "EP-P3";

const finite = z.number({ error: "EP-1: must be a finite number" });
const XYSchema = z.tuple([finite, finite]);

export const ExactPointsSchema = z.object({
	kind: z.literal("points"),
	/** Each point is a corner; the last is the shape's end. At least one. */
	points: z.array(XYSchema),
});

export const ExactArcSchema = z.object({
	kind: z.literal("arc"),
	to: XYSchema,
	/** Signed sagitta over chord, `0 < |bend| ≤ 1/2` (EP-3) */
	bend: finite,
});

export const ExactCubicSchema = z.object({
	kind: z.literal("cubic"),
	c1: XYSchema,
	c2: XYSchema,
	to: XYSchema,
});

export const ExactShapeSchema = z.discriminatedUnion("kind", [
	ExactPointsSchema,
	ExactArcSchema,
	ExactCubicSchema,
]);

export const ExactKeySchema = z.object({
	/** Whole ticks from the move's start, 480 per beat */
	tick: finite,
	/** The place: piece number plus the share of that piece, 0 to the piece count */
	u: finite,
});

/**
 * One marcher's walk during one move: shapes plus timing keys. Validating it
 * applies rules EP-1 to EP-6; each problem's message starts with the rule's id,
 * and problems from the rule checks also carry `params.rule`.
 */
export const ExactPathSchema = z
	.object({
		v: z.literal(1, { error: "EP-1: v must be 1" }),
		/** Where the walk starts */
		from: XYSchema,
		/** At least one; each starts where the last ended */
		shapes: z.array(ExactShapeSchema),
		/** At least two */
		keys: z.array(ExactKeySchema),
	})
	.superRefine((path, ctx) => {
		for (const problem of checkExactPath(path)) {
			ctx.addIssue({
				code: "custom",
				message: `${problem.rule}: ${problem.message}`,
				path: problem.path,
				params: { rule: problem.rule satisfies ExactPathRule },
			});
		}
	});

/**
 * One exact path in a show, placed in time on its own: it doesn't depend on
 * pages, so it stays put when a page boundary moves.
 */
export const ExactPathEntrySchema = z.object({
	/** The marcher who walks it: the same ids as `coordinates[].marcherId` */
	marcherId: z.string(),
	/**
	 * When the move starts, in whole ticks from the start of the show at 480
	 * per beat: beat `b` (on the same scale as `startBeatIndex`) is tick
	 * `b × 480`. The path's own key ticks count from here.
	 */
	startTick: z.number(),
	/** When the move ends: `startTick` plus the path's last key tick (EP-P2) */
	endTick: z.number(),
	/** The walk itself */
	path: ExactPathSchema,
});

/**
 * A show's exact paths. Besides each path's own rules, checks that each one is
 * placed sensibly: EP-P1 (`startTick` is a whole number, 0 or more), EP-P2
 * (`endTick` is `startTick` plus the last key's tick) and EP-P3 (one marcher's
 * exact paths don't overlap in time; one may start on the tick another ends).
 */
export const ExactPathListSchema = z
	.array(ExactPathEntrySchema)
	.superRefine((entries, ctx) => {
		const add = (
			rule: ExactPathPlacementRule,
			message: string,
			path: (string | number)[],
		) =>
			ctx.addIssue({
				code: "custom",
				message: `${rule}: ${message}`,
				path,
				params: { rule },
			});
		const byMarcher = new Map<string, number[]>();
		entries.forEach((entry, i) => {
			if (!Number.isInteger(entry.startTick) || entry.startTick < 0)
				add(
					"EP-P1",
					`startTick ${entry.startTick} is not a whole number of ticks, 0 or more`,
					[i, "startTick"],
				);
			const lastKey = entry.path.keys[entry.path.keys.length - 1];
			if (
				lastKey &&
				entry.path.keys.length >= 2 &&
				entry.endTick !== entry.startTick + lastKey.tick
			)
				add(
					"EP-P2",
					`endTick ${entry.endTick} is not startTick ${entry.startTick} plus the path's length of ${lastKey.tick} ticks`,
					[i, "endTick"],
				);
			const list = byMarcher.get(entry.marcherId);
			if (list) list.push(i);
			else byMarcher.set(entry.marcherId, [i]);
		});
		for (const [marcherId, indexes] of byMarcher) {
			const sorted = [...indexes].sort(
				(a, b) =>
					(entries[a]?.startTick ?? 0) - (entries[b]?.startTick ?? 0) || a - b,
			);
			for (let k = 1; k < sorted.length; k++) {
				const prevIndex = sorted[k - 1] as number;
				const index = sorted[k] as number;
				const prev = entries[prevIndex];
				const next = entries[index];
				if (prev && next && next.startTick < prev.endTick)
					add(
						"EP-P3",
						`marcher ${marcherId}'s exact paths ${prevIndex} and ${index} overlap in time`,
						[index, "startTick"],
					);
			}
		}
	});

/** One exact path in a show (see {@link ExactPathEntrySchema}). */
export interface ExactPathEntry {
	marcherId: string;
	startTick: number;
	endTick: number;
	path: ExactPath;
}

// Parsed data must fit the hand-written types the functions take.
type Assert<T extends true> = T;
type _ParsedPathFits = Assert<
	z.output<typeof ExactPathSchema> extends ExactPath ? true : false
>;
type _ParsedEntryFits = Assert<
	z.output<typeof ExactPathEntrySchema> extends ExactPathEntry ? true : false
>;
