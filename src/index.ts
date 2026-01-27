// Schema exports

// JSON Schema exports
export { getJsonSchema, getJsonSchemaString } from "./json-schema";
export {
	CheckpointSchema,
	CoordinateSchema,
	MeasureSchema,
	OpenMarchSchema,
	PageSchema,
	PerformanceAreaSchema,
	PerformerSchema,
	SCHEMA_VERSION,
	ShowMetadataSchema,
	TempoSectionSchema,
	XCheckpointSchema,
	YCheckpointSchema,
} from "./schema";
// Type exports
export type {
	Checkpoint,
	Coordinate,
	Measure,
	OpenMarchSchema as OpenMarchSchemaType,
	Page,
	PerformanceArea,
	Performer,
	ShowMetadata,
	TempoSection,
	XCheckpoint,
	YCheckpoint,
} from "./types";
export * from "./utils";
// Validation exports
export {
	formatValidationErrors,
	isValidOpenMarchData,
	parseOpenMarchSchema,
	safeParseOpenMarchSchema,
	safeValidateOpenMarchData,
	type ValidationResult,
	validateOpenMarchData,
} from "./validate";
