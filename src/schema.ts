import { z } from "zod";
import { ExactPathListSchema } from "./exact-path/schema";

// ============================================================================
// VERSION
// ============================================================================

/** Current schema version */
export const SCHEMA_VERSION = "0.3.0" as const;

// ============================================================================
// CHECKPOINT
// ============================================================================

const CheckpointSchema = z.object({
	/**
	 * "50 yard line", "front hash", "real college back hash", "grid high school back hash"
	 */
	name: z.string(),

	/**
	 * A shorthand to put on abbreviated coordinates.
	 * E.g. back sideline -> bsl; 35 yard line -> 35
	 */
	terseName: z.string(),

	/**
	 * True if the performer should reference this checkpoint.
	 * False if you just want this checkpoint to be visible on the canvas but not referenced.
	 */
	useAsReference: z.boolean(),

	/**
	 * Number/label to put on the field for reference. E.g. 50 yard line, 20 yard line, etc.
	 */
	fieldLabel: z.string().optional(),

	/**
	 * Whether or not this checkpoint should be visible on the canvas.
	 * If false, it will not be drawn. Default is true if not defined.
	 */
	visible: z.boolean(),
});

const XCheckpointSchema = CheckpointSchema.extend({
	stepsFromCenter: z.number(),
});

const YCheckpointSchema = CheckpointSchema.extend({
	stepsFromYOrigin: z.number(),
});

// ============================================================================
// PERFORMANCE AREA
// ============================================================================

export const PerformanceAreaSchema = z.object({
	/** The y-origin where coordinates are measured from */
	yOrigin: z.enum(["front", "center"]),

	/** Number of inches a step in the real world is. E.g. 22.5 for 8-to-5 */
	inchesPerStep: z.number(),

	/** Checkpoints on the x-axis */
	xCheckpoints: z.array(XCheckpointSchema),

	/** Checkpoints on the y-axis */
	yCheckpoints: z.array(YCheckpointSchema),

	/** Width of the performance area in feet */
	widthFeet: z.number(),

	/** Height of the performance area in feet */
	heightFeet: z.number(),

	/** Whether or not to use hashes on the field */
	useHashes: z.boolean(),
});

// ============================================================================
// METADATA
// ============================================================================

const BaseMetadataSchema = z.object({
	/** UTC timestamp when this show was created */
	createdAtUtc: z.string(),

	audioOffsetSeconds: z.number().optional(),

	/** Show title, school, year, etc. (optional) */
	info: z
		.object({
			title: z.string().optional(),
			author: z.string().optional(),
			school: z.string().optional(),
			year: z.string().optional(),
		})
		.catchall(z.any())
		.optional(),
});

export const ShowMetadataSchema = BaseMetadataSchema.extend({
	/** Field configuration */
	performanceArea: PerformanceAreaSchema,
});

export const TempoMetadataSchema = BaseMetadataSchema.extend({});

// ============================================================================
// TIMELINE
// ============================================================================

export const TempoSectionSchema = z.object({
	/** Tempo in beats per minute */
	tempo: z.number(),

	/** Number of beats in this tempo section that will be played at this tempo */
	numberOfBeats: z.number(),
});

export const MeasureSchema = z.object({
	/** Beat index where this measure starts */
	startBeatIndex: z.number(),

	/** Measure number/label */
	name: z.string(),

	/** Rehearsal mark (e.g., "A", "B", "Intro") */
	rehearsalMark: z.string().optional(),
});

export const PageSchema = z.object({
	/** Unique page identifier */
	id: z.string(),

	/** Total duration of this page in seconds */
	duration: z.number(),

	/** Beat index where this set starts */
	startBeatIndex: z.number(),

	/** True if this is a subset page */
	isSubset: z.boolean().optional(),

	/** Set label */
	name: z.string(), // e.g., "Opening", "Set 1", "Closer"
});

// ============================================================================
// PERFORMERS
// ============================================================================

export const PerformerSchema = z.object({
	/** Unique marcher identifier */
	id: z.number(),

	/** Full drill number (e.g., "BD1", "T12") - computed from prefix + order */
	label: z.string(),

	/** Section name (e.g., "Baritone", "Color Guard") */
	section: z.string(),

	/** Marcher's name (optional, e.g. "Jeff") */
	name: z.string().optional(),

	/** Optional notes */
	notes: z.string().optional(),
});

// ============================================================================
// DRILL COORDINATES
// ============================================================================

export const CoordinateSchema = z.object({
	/** Marcher ID this coordinate belongs to */
	marcherId: z.string(),

	/** Page ID this coordinate belongs to */
	pageId: z.string(),

	/** X coordinate in steps from center (0 = 50 yard line) */
	xSteps: z.number(),

	/** Y coordinate in steps from front sideline (0 = front, positive = toward back) */
	ySteps: z.number(),

	/** Rotation in degrees (0 = facing top of field) */
	rotation_degrees: z.number().optional(),
});

// ============================================================================
// PERFORMER APPEARANCE
// ============================================================================

const RgbaSchema = z
	.string()
	.regex(/^rgba\(\d{1,3},\d{1,3},\d{1,3},(?:0(?:\.\d+)?|1(?:\.0+)?)\)$/, {
		message:
			"Must be a valid rgba color string - e.g. 'rgba(255,255,255,0.98)' (alpha 0–1)",
	});
export const PerformerAppearanceSchema = z.object({
	fillRgba: RgbaSchema,
	strokeRgba: RgbaSchema,
	strokeWidth: z.number().positive().default(1),
	visible: z.boolean().default(true),
	textVisible: z.boolean().default(true),
	shape: z.enum(["circle", "square", "triangle", "cross"]),
});

/**
 * Individual performer appearance data per-page. This appearance only applies to the given page.
 *
 * I.e. if `pageId=1`, this would apply from page 1 to the start of page 2.
 *
 * This appearance takes precedence over section appearance or default appearance.
 */
export const IndividualPerformerAppearanceSchema =
	PerformerAppearanceSchema.extend({
		marcherId: z.string(),
		pageId: z.string(),
	});

/**
 * Section performer appearance data. This appearance applies to performers for all pages in the show.
 *
 * This appearance takes precedence over default appearance.
 */
export const SectionPerformerAppearanceSchema =
	PerformerAppearanceSchema.extend({
		section: z.string(),
	});

export const PerformerAppearanceShowDataSchema = z.object({
	/** Default appearance for all performers in the show */
	defaultAppearance: PerformerAppearanceSchema.optional(),

	/**
	 * Individual performer appearance data per-page. This appearance only applies to the given page.
	 *
	 * I.e. if `pageId=1`, this would apply from page 1 to the start of page 2.
	 *
	 * This appearance takes precedence over section appearance or default appearance.
	 * If this is not defined for a performer, fall back to section appearance, then default appearance.
	 */
	performers: z.array(IndividualPerformerAppearanceSchema).optional(),

	/**
	 * Section performer appearance data. This appearance applies to performers for all pages in the show.
	 *
	 * This appearance takes precedence over default appearance. If this is not defined for a section, fall back to default appearance.
	 */
	sections: z.array(SectionPerformerAppearanceSchema).optional(),
});

// ============================================================================
// MAIN SCHEMA
// ============================================================================

export const OpenMarchSchema = z.object({
	/** Schema version for future compatibility */
	omSchemaVersion: z.string().default(SCHEMA_VERSION),

	/** Show metadata and settings */
	metadata: ShowMetadataSchema,

	/** All marchers in the show */
	performers: z.array(PerformerSchema),

	/** Performer appearance data */
	performerAppearance: PerformerAppearanceShowDataSchema.optional(),

	/** All pages in the show */
	pages: z.array(PageSchema),

	/** All tempo sections in the show */
	tempoSections: z.array(TempoSectionSchema),

	/** Coordinates */
	coordinates: z.array(CoordinateSchema),

	/** All measures in the show */
	measures: z.array(MeasureSchema).optional(),

	/**
	 * Exact paths (since schema 0.3.0): the real walk of a marcher during a
	 * move, curves included, as shapes plus timing keys. Optional. In a page
	 * (the walk into a set) that has an exact path for the marcher, the marcher
	 * follows it between its `startTick` and `endTick` and stands still on the
	 * page's other counts (at the end of the path before, or the start of the
	 * page's first path). In a page without one, and in readers that don't know
	 * this field, the marcher walks a straight line between sets as before.
	 *
	 * Coordinates are in steps on the same axes as `coordinates`: x from the
	 * center of the field (negative to the audience's left), y from the y-origin
	 * toward the back of the field (from the front sideline when `yOrigin` is
	 * `"front"`). That y points up the field, the opposite of OpenMarch's
	 * on-screen y (down): converting between the two negates each y and also
	 * each arc's `bend`, because flipping y mirrors which side the arc bows to.
	 *
	 * Each path is placed by its own start and end tick, not by a page, so the
	 * path stays where it is in time when a page boundary moves (though which
	 * uncovered counts are holds follows the pages). Rules EP-1 to EP-6 and
	 * EP-P1 to EP-P3 apply; see the README.
	 */
	exactPaths: ExactPathListSchema.optional(),
});

// ============================================================================
// OPENMARCH TEMPO (.omt) - timing data only
// ============================================================================

export const OpenMarchTempoDataSchema = z.object({
	/** Schema version for future compatibility */
	omSchemaVersion: z.string().default(SCHEMA_VERSION),

	/** Show metadata and settings */
	metadata: TempoMetadataSchema,

	/** All pages in the show */
	pages: z.array(PageSchema),

	/** All tempo sections in the show */
	tempoSections: z.array(TempoSectionSchema),

	/** All measures in the show */
	measures: z.array(MeasureSchema).optional(),
});

// Re-export sub-schemas for convenience
export { CheckpointSchema, XCheckpointSchema, YCheckpointSchema };
