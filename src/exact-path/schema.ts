import { z } from "zod";
import {
	checkExactPath,
	type ExactPath,
	type ExactPathRule,
	type XY,
} from "./exactPath";

/** The id of a rule a show's `exactPaths` list must keep, beyond each path's own. */
export type ExactPathPlacementRule = "EP-P1" | "EP-P2" | "EP-P3";

// The rules themselves are checked by `checkExactPath` and the list's
// refinement, so every problem names its rule. `.meta()` only adds the same
// limits to the JSON Schema, for readers in other languages.

const finite = z.number({ error: "EP-1: must be a finite number" });
// `.meta()` replaces a tuple's own limits in the JSON Schema, so restate them.
const XY_LIMITS = { minItems: 2, maxItems: 2, items: false } as const;
const XYSchema: z.ZodType<XY, XY> = z
	.tuple([finite, finite])
	.meta({ ...XY_LIMITS, description: "[x, y] in steps" });
/** A point with its own description */
const pointWith = (description: string) =>
	XYSchema.meta({ ...XY_LIMITS, description });
const wholeTicks = (description: string) =>
	z.number().meta({ type: "integer", minimum: 0, description });

export const ExactPointsSchema = z.object({
	kind: z.literal("points"),
	points: z.array(XYSchema).meta({
		minItems: 1,
		description:
			"Straight lines through these points: each is a corner, the last is the shape's end (EP-2)",
	}),
});

export const ExactArcSchema = z.object({
	kind: z.literal("arc"),
	to: XYSchema,
	bend: finite.meta({
		minimum: -0.5,
		maximum: 0.5,
		not: { const: 0 },
		description:
			"Signed sagitta over chord, 0 < |bend| ≤ 1/2 (EP-3). The arc's middle is M + bend·c·n: M the chord's midpoint, c its length, n = (−dy, dx)/c the chord direction turned +90°. With .om's y up the field, a positive bend on a chord along +x bows toward the back. In a y-down system (OpenMarch on screen, SVG), negate bend along with y.",
	}),
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
	tick: wholeTicks("Whole ticks from the move's start, 480 per beat (EP-5)"),
	u: finite.meta({
		minimum: 0,
		description:
			"The place: piece number plus the share of that piece's length, 0 to the piece count (EP-5)",
	}),
});

/**
 * One marcher's walk during one move: shapes plus timing keys. Validating it
 * applies rules EP-1 to EP-6. Each break of a rule has a message starting with
 * the rule's id, and those from the rule checks also carry `params.rule`. Data
 * of the wrong shape (a missing field, an unknown `kind`) gets Zod's usual
 * shape errors.
 */
export const ExactPathSchema = z
	.object({
		v: z.literal(1, { error: "EP-1: v must be 1" }),
		from: pointWith("Where the walk starts, [x, y] in steps"),
		shapes: z.array(ExactShapeSchema).meta({
			minItems: 1,
			description: "Each shape starts where the last one ended (EP-2)",
		}),
		keys: z.array(ExactKeySchema).meta({
			minItems: 2,
			description:
				"Timing: first {tick: 0, u: 0}, last u is the piece count, ticks strictly increase, u never decreases; steady speed between keys (EP-5)",
		}),
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
 * pages, so the path stays where it is in time when a page boundary moves.
 */
export const ExactPathEntrySchema = z.object({
	marcherId: z.string().meta({
		description: "The marcher who walks it: the same ids as coordinates",
	}),
	startTick: wholeTicks(
		"When the move starts: whole ticks from the start of the show, 480 per beat, on the same beat scale as startBeatIndex (beat b is tick b × 480). The path's key ticks count from here (EP-P1)",
	),
	endTick: wholeTicks(
		"When the move ends: startTick plus the path's last key tick (EP-P2)",
	),
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
	.meta({
		description:
			"Exact paths: a marcher's real walk during a move, placed by start and end tick. In a page (the walk into a set) with an exact path for the marcher, the marcher follows it and stands still on the page's other counts; in a page without one, it walks a straight line between sets. Coordinates are steps on the same axes as coordinates (y up the field). Rules EP-1 to EP-6 and EP-P1 to EP-P3 apply; see the README.",
	})
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
			const at = (i: number) => entries[i] as (typeof entries)[number];
			const sorted = [...indexes].sort(
				(a, b) => at(a).startTick - at(b).startTick || a - b,
			);
			// compare each path with the one reaching furthest so far, not just its neighbor
			let furthest = sorted[0] as number;
			for (const index of sorted.slice(1)) {
				if (at(index).startTick < at(furthest).endTick)
					add(
						"EP-P3",
						`marcher ${marcherId}'s exact paths ${furthest} and ${index} overlap in time`,
						[index, "startTick"],
					);
				if (at(index).endTick > at(furthest).endTick) furthest = index;
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

// Parsed data and the hand-written types the functions take must fit each
// other both ways, so a show built from `ExactPathEntry` values type-checks.
type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _PathFits = Assert<Same<z.output<typeof ExactPathSchema>, ExactPath>>;
type _EntryFits = Assert<
	Same<z.output<typeof ExactPathEntrySchema>, ExactPathEntry>
>;
type _InputFits = Assert<
	ExactPathEntry extends z.input<typeof ExactPathEntrySchema> ? true : false
>;
