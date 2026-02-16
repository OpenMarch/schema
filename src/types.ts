import type { z } from "zod";
import type {
	CheckpointSchema,
	CoordinateSchema,
	MeasureSchema,
	OpenMarchSchema,
	OpenMarchTempoDataSchema,
	PageSchema,
	PerformanceAreaSchema,
	PerformerSchema,
	ShowMetadataSchema,
	TempoSectionSchema,
	XCheckpointSchema,
	YCheckpointSchema,
} from "./schema";

// Infer TypeScript types from Zod schemas
export type OpenMarchShowData = z.infer<typeof OpenMarchSchema>;
export type OpenMarchTempoData = z.infer<typeof OpenMarchTempoDataSchema>;
export type ShowMetadata = z.infer<typeof ShowMetadataSchema>;
export type PerformanceArea = z.infer<typeof PerformanceAreaSchema>;
export type TempoSection = z.infer<typeof TempoSectionSchema>;
export type Measure = z.infer<typeof MeasureSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Performer = z.infer<typeof PerformerSchema>;
export type Coordinate = z.infer<typeof CoordinateSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type XCheckpoint = z.infer<typeof XCheckpointSchema>;
export type YCheckpoint = z.infer<typeof YCheckpointSchema>;
