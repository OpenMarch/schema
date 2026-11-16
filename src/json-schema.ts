import { z } from "zod";
import { OpenMarchPlaybackShapeSchema } from "./playback/schema";
import { SUPPORTED_PLAYBACK_VERSION_PATTERN } from "./playback/version";
import { OpenMarchSchema, OpenMarchTempoDataSchema } from "./schema";

/**
 * Get the JSON Schema representation of the OpenMarch schema.
 * This can be used for validation in other languages or tools.
 */
export function getJsonSchema() {
	return z.toJSONSchema(OpenMarchSchema);
}

/**
 * Get the JSON Schema as a formatted string.
 */
export function getJsonSchemaString(indent = 2): string {
	return JSON.stringify(getJsonSchema(), null, indent);
}

/**
 * Get the JSON Schema representation of the OpenMarch Tempo (.omt) schema.
 * This can be used for validation in other languages or tools.
 */
export function getOpenMarchTempoDataJsonSchema() {
	return z.toJSONSchema(OpenMarchTempoDataSchema);
}

/**
 * Get the OpenMarch Tempo JSON Schema as a formatted string.
 */
export function getOpenMarchTempoDataJsonSchemaString(indent = 2): string {
	return JSON.stringify(getOpenMarchTempoDataJsonSchema(), null, indent);
}

/**
 * Get the JSON Schema representation of the OpenMarch playback (.ompb) schema.
 *
 * It describes the file's shape only: the checker's rules (coverage,
 * continuity, page points, drawing ends, references) can't be written in JSON
 * Schema, so validate with this package to apply them. Unknown fields are
 * allowed, since readers must ignore fields they don't know.
 */
export function getOpenMarchPlaybackJsonSchema() {
	const schema = z.toJSONSchema(OpenMarchPlaybackShapeSchema, { io: "input" });
	// The version check is a refinement, which JSON Schema can't see; add it as
	// a pattern so readers in other languages refuse versions they can't read.
	const version = schema.properties?.ompbVersion;
	if (version && typeof version === "object") {
		version.pattern = SUPPORTED_PLAYBACK_VERSION_PATTERN;
	}
	return schema;
}

/**
 * Get the OpenMarch playback JSON Schema as a formatted string.
 */
export function getOpenMarchPlaybackJsonSchemaString(indent = 2): string {
	return JSON.stringify(getOpenMarchPlaybackJsonSchema(), null, indent);
}
