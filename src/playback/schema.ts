/**
 * The `.ompb` (OpenMarch playback) schema.
 *
 * It has its own copies of everything it shares with `.om`, so a change to
 * `.om` never changes `.ompb` without an `ompbVersion` bump. Fields that only
 * change how something looks take any value where a future version might add
 * options (readers fall back for values they don't know), so adding one is not
 * breaking. Fields that change positions or timing stay strict.
 *
 * Every field the exporter always writes is required: the file is worked out
 * ahead of time, and readers in other languages shouldn't have to re-create
 * defaults.
 */
import { z } from "zod";
import { checkPlaybackData } from "./check";
import {
	isSupportedPlaybackVersion,
	unsupportedVersionMessage,
} from "./version";

// ============================================================================
// PATH STRINGS
// ============================================================================

/** A plain decimal number: no exponent, no leading "+", no bare ".5". */
const NUM = String.raw`-?\d+(?:\.\d+)?`;
const POINT = `${NUM} ${NUM}`;

/**
 * Exactly one `M` at the start, then any number of `L` and `C` segments, all
 * absolute, a command letter before every segment, single spaces between all
 * letters and numbers.
 */
export const PLAYBACK_PATH_REGEX = new RegExp(
	`^M ${POINT}(?: (?:L ${POINT}|C ${POINT} ${POINT} ${POINT}))*$`,
);

const PlaybackPathSchema = z.string().regex(PLAYBACK_PATH_REGEX, {
	message:
		"Must be an absolute SVG path: one 'M' then 'L'/'C' segments, a letter before each segment, single spaces, plain decimal numbers",
});

const WholeNumber = z.number().int().nonnegative();

// ============================================================================
// METADATA (copied from .om)
// ============================================================================

const PlaybackCheckpointSchema = z.object({
	/** "50 yard line", "front hash", ... */
	name: z.string(),
	/** Shorthand for abbreviated coordinates, e.g. "bsl", "35" */
	terseName: z.string(),
	/** True if performers' coordinates should reference this checkpoint */
	useAsReference: z.boolean(),
	/** Label to draw on the field, e.g. "50" */
	fieldLabel: z.string().optional(),
	/** Whether this checkpoint is drawn */
	visible: z.boolean(),
});

const PlaybackPerformanceAreaSchema = z.object({
	/**
	 * Where y is measured from. Changes what every position means, so a new
	 * option is a breaking change.
	 */
	yOrigin: z.enum(["front", "center"]),
	/** Inches in one step, e.g. 22.5 for 8 to 5 */
	inchesPerStep: z.number().positive(),
	/** Checkpoints along x */
	xCheckpoints: z.array(
		PlaybackCheckpointSchema.extend({ stepsFromCenter: z.number() }),
	),
	/** Checkpoints along y */
	yCheckpoints: z.array(
		PlaybackCheckpointSchema.extend({ stepsFromYOrigin: z.number() }),
	),
	/** Width of the performance area in feet */
	widthFeet: z.number(),
	/** Height of the performance area in feet */
	heightFeet: z.number(),
	/** Whether to draw hashes */
	useHashes: z.boolean(),
});

export const PlaybackMetadataSchema = z.object({
	/** UTC timestamp when this show was created */
	createdAtUtc: z.string(),
	/** Seconds to offset the audio by */
	audioOffsetSeconds: z.number().optional(),
	/** Show title, school, year, etc. */
	info: z
		.object({
			title: z.string().optional(),
			author: z.string().optional(),
			school: z.string().optional(),
			year: z.string().optional(),
		})
		.catchall(z.unknown())
		.optional(),
	/** Field configuration */
	performanceArea: PlaybackPerformanceAreaSchema,
});

// ============================================================================
// PERFORMERS AND APPEARANCE (copied from .om)
// ============================================================================

export const PlaybackPerformerSchema = z.object({
	/** Unique marcher identifier. Text everywhere in `.ompb`. */
	id: z.string(),
	/** Full drill number (e.g., "BD1", "T12") */
	label: z.string(),
	/** Section name (e.g., "Baritone", "Color Guard") */
	section: z.string(),
	/** Marcher's name (e.g. "Jeff") */
	name: z.string().optional(),
	/** Notes */
	notes: z.string().optional(),
});

const RgbaSchema = z
	.string()
	.regex(/^rgba\(\d{1,3},\d{1,3},\d{1,3},(?:0(?:\.\d+)?|1(?:\.0+)?)\)$/, {
		message:
			"Must be a valid rgba color string - e.g. 'rgba(255,255,255,0.98)' (alpha 0–1)",
	});

export const PlaybackAppearanceSchema = z.object({
	fillRgba: RgbaSchema,
	strokeRgba: RgbaSchema,
	strokeWidth: z.number().nonnegative(),
	visible: z.boolean(),
	textVisible: z.boolean(),
	/**
	 * "circle", "square", "triangle" or "cross" today. Any text is allowed so
	 * a new shape isn't breaking; draw a circle for a shape you don't know.
	 */
	shape: z.string(),
});

const PlaybackAppearanceDataSchema = z.object({
	/** Appearance for every performer, unless a section or individual one applies */
	defaultAppearance: PlaybackAppearanceSchema.optional(),
	/**
	 * One marcher's appearance from when they are on `pageId`'s set until they
	 * are on the next set (the last page's runs to the end of the show). Takes
	 * precedence over section and default appearance.
	 */
	performers: z
		.array(
			PlaybackAppearanceSchema.extend({
				marcherId: z.string(),
				pageId: z.string(),
			}),
		)
		.optional(),
	/** A section's appearance for the whole show. Takes precedence over the default. */
	sections: z
		.array(PlaybackAppearanceSchema.extend({ section: z.string() }))
		.optional(),
});

// ============================================================================
// TIMING
// ============================================================================

export const PlaybackTempoSectionSchema = z.object({
	/** Tempo in beats per minute. Always above 0: there is no zero-length first beat. */
	tempo: z.number().positive(),
	/** Number of beats played at this tempo */
	numberOfBeats: z.number().int().positive(),
});

export const PlaybackMeasureSchema = z.object({
	/**
	 * Beat index where this measure starts. Beat 0 is the first counted beat.
	 * Measures are listed in order; a measure lasts until the next one starts.
	 */
	startBeatIndex: WholeNumber,
	/** Measure number/label */
	name: z.string(),
	/** Rehearsal mark (e.g., "A", "B", "Intro") */
	rehearsalMark: z.string().optional(),
});

export const PlaybackPageSchema = z.object({
	/** Unique page identifier */
	id: z.string(),
	/** Set label, e.g. "Set 4" */
	name: z.string(),
	/**
	 * First count of the walk into this set. Each page starts where the previous
	 * one ends. Set 1 and set 2 both start at 0, so never sort pages by this:
	 * the list order is the show order.
	 */
	startBeatIndex: WholeNumber,
	/**
	 * Counts to get to this set. Marchers are on the set at
	 * `startBeatIndex + counts`. Set 1 normally has 0; any counts it has come
	 * before set 2's walk, and marchers hold on set 1 during them.
	 */
	counts: WholeNumber,
	/** True if this is a subset page. Only affects naming and listing. */
	isSubset: z.boolean().optional(),
	/**
	 * Marcher ID → SVG path of the walk into this set, in field steps, for
	 * display only. Positions always come from `moves`. A marcher who stays put
	 * has no entry, and the first page has none.
	 */
	paths: z.record(z.string(), PlaybackPathSchema),
});

export const PlaybackMoveSchema = z
	.object({
		/** The marcher making this move */
		marcherId: z.string(),
		/**
		 * Step rate in ticks (480 = one step per beat at 480 ticks per beat).
		 * Steps count from the move's first tick. Only used to show where steps
		 * land; when missing, show no step marks.
		 */
		ticksPerStep: z.number().int().positive().optional(),
		/** At least two whole-number ticks that never go backward */
		ticks: z.array(WholeNumber).min(2),
		/** Interleaved x, y pairs in field steps, one pair per tick */
		xy: z.array(z.number()),
	})
	.refine((move) => move.xy.length === 2 * move.ticks.length, {
		message: "xy must hold exactly one x, y pair per tick",
		path: ["xy"],
	});

// ============================================================================
// MAIN SCHEMA
// ============================================================================

/**
 * The shape of an `.ompb` file, without the cross-field rules. The JSON Schema
 * is generated from this, since JSON Schema can't express those rules.
 */
export const OpenMarchPlaybackShapeSchema = z.object({
	/** Playback format version, separate from `.om`'s `omSchemaVersion` */
	ompbVersion: z.string().refine(isSupportedPlaybackVersion, {
		error: (issue) => unsupportedVersionMessage(String(issue.input)),
		params: { playbackCode: "version.unsupported" },
		abort: true,
	}),
	/** Each beat is split into this many ticks. The exporter writes 480. */
	ticksPerBeat: z.number().int().positive(),
	/** Show settings and the performance area */
	metadata: PlaybackMetadataSchema,
	/** All marchers in the show */
	performers: z.array(PlaybackPerformerSchema),
	/** Performer appearance */
	performerAppearance: PlaybackAppearanceDataSchema.optional(),
	/** Tempo sections. Every tempo is above 0. */
	tempoSections: z.array(PlaybackTempoSectionSchema),
	/** Measures in order, with beat 0 as the first counted beat */
	measures: z.array(PlaybackMeasureSchema).optional(),
	/** Pages in show order */
	pages: z.array(PlaybackPageSchema).min(1),
	/** Every move by every marcher, for the whole show */
	moves: z.array(PlaybackMoveSchema),
});

/**
 * The `.ompb` schema: the shape plus every rule the checker enforces. Rule
 * problems carry their playback code in the Zod issue's `params.playbackCode`.
 * Prefer `safeValidateOpenMarchPlaybackData`, which returns those codes directly.
 */
export const OpenMarchPlaybackSchema =
	OpenMarchPlaybackShapeSchema.check(checkPlaybackData);
