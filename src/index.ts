// Schema exports

// JSON Schema exports
export {
	getJsonSchema,
	getJsonSchemaString,
	getOpenMarchTempoJsonSchema,
	getOpenMarchTempoJsonSchemaString,
} from "./json-schema";
export {
	CheckpointSchema,
	CoordinateSchema,
	MeasureSchema,
	OpenMarchSchema,
	OpenMarchTempoSchema,
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
	OpenMarchTempo,
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
	parseOpenMarchTempoSchema,
	safeParseOpenMarchSchema,
	safeParseOpenMarchTempoSchema,
	safeValidateOpenMarchData,
	safeValidateOpenMarchTempoData,
	type ValidationResult,
	validateOpenMarchData,
	validateOpenMarchTempoData,
} from "./validate";
