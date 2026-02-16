// Schema exports

// JSON Schema exports
export {
	getJsonSchema,
	getJsonSchemaString,
	getOpenMarchTempoDataJsonSchema,
	getOpenMarchTempoDataJsonSchemaString,
} from "./json-schema";
export {
	CheckpointSchema,
	CoordinateSchema,
	MeasureSchema,
	OpenMarchSchema,
	OpenMarchTempoDataSchema,
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
	OpenMarchShowData,
	OpenMarchTempoData,
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
	isValidOpenMarchTempoData,
	parseOpenMarchSchema,
	parseOpenMarchTempoDataSchema,
	safeParseOpenMarchSchema,
	safeParseOpenMarchTempoDataSchema,
	safeValidateOpenMarchData,
	safeValidateOpenMarchTempoData,
	type ValidationResult,
	validateOpenMarchData,
	validateOpenMarchTempoData,
} from "./validate";
