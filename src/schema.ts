import { z } from "zod";

// ============================================================================
// VERSION
// ============================================================================

/** Current schema version */
export const SCHEMA_VERSION = "1.0.0" as const;

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

	/** Width of the performance area in inches */
	widthInches: z.number(),

	/** Height of the performance area in inches */
	heightInches: z.number(),

	/** Whether or not to use hashes on the field */
	useHashes: z.boolean(),
});

// ============================================================================
// METADATA
// ============================================================================

export const ShowMetadataSchema = z.object({
	/** Field configuration */
	performanceArea: PerformanceAreaSchema,

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
// MAIN SCHEMA
// ============================================================================

export const OpenMarchSchema = z.object({
	/** Schema version for future compatibility */
	omSchemaVersion: z.string().default(SCHEMA_VERSION),

	/** Show metadata and settings */
	metadata: ShowMetadataSchema,

	/** All marchers in the show */
	performers: z.array(PerformerSchema),

	/** All pages in the show */
	pages: z.array(PageSchema),

	/** All tempo sections in the show */
	tempoSections: z.array(TempoSectionSchema),

	/** Coordinates */
	coordinates: z.array(CoordinateSchema),

	/** All measures in the show */
	measures: z.array(MeasureSchema).optional(),
});

// Re-export sub-schemas for convenience
export { CheckpointSchema, XCheckpointSchema, YCheckpointSchema };
