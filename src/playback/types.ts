import type { z } from "zod";
import type {
	OpenMarchPlaybackShapeSchema,
	PlaybackAppearanceSchema,
	PlaybackMeasureSchema,
	PlaybackMetadataSchema,
	PlaybackMoveSchema,
	PlaybackPageSchema,
	PlaybackPerformerSchema,
	PlaybackTempoSectionSchema,
} from "./schema";

/** A whole `.ompb` file */
export type OpenMarchPlaybackData = z.infer<
	typeof OpenMarchPlaybackShapeSchema
>;
export type PlaybackMetadata = z.infer<typeof PlaybackMetadataSchema>;
export type PlaybackPerformer = z.infer<typeof PlaybackPerformerSchema>;
export type PlaybackAppearance = z.infer<typeof PlaybackAppearanceSchema>;
export type PlaybackTempoSection = z.infer<typeof PlaybackTempoSectionSchema>;
export type PlaybackMeasure = z.infer<typeof PlaybackMeasureSchema>;
export type PlaybackPage = z.infer<typeof PlaybackPageSchema>;
export type PlaybackMove = z.infer<typeof PlaybackMoveSchema>;
