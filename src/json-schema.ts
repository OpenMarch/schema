import { z } from "zod";
import { OpenMarchPlaybackShapeSchema } from "./playback/schema";
import { SUPPORTED_PLAYBACK_VERSION_PATTERN } from "./playback/version";
import { OpenMarchSchema, OpenMarchTempoDataSchema } from "./schema";

type JsonObjectSchema = {
	additionalProperties?: unknown;
	properties?: Record<string, unknown>;
};

/**
 * Allow fields this version doesn't know on an object of a generated schema,
 * as this package's own reader does (it drops them). Without this, a JSON
 * Schema validator refuses files written by a newer version.
 */
function allowUnknownFields(schema: unknown) {
	if (schema && typeof schema === "object")
		delete (schema as JsonObjectSchema).additionalProperties;
}

/**
 * Get the JSON Schema representation of the OpenMarch schema.
 * This can be used for validation in other languages or tools.
 *
 * Unknown top-level fields are allowed: new versions add optional fields
 * there (such as `exactPaths` in 0.3.0), and files carry a `schema` key.
 */
export function getJsonSchema() {
	const schema = z.toJSONSchema(OpenMarchSchema);
	allowUnknownFields(schema);
	return schema;
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
 *
 * Unknown fields are allowed at the top level and in `metadata`, as for the
 * full show. In `metadata` this keeps older tempo files valid: they carried a
 * `performanceArea`, which the tempo schema no longer has.
 */
export function getOpenMarchTempoDataJsonSchema() {
	const schema = z.toJSONSchema(OpenMarchTempoDataSchema);
	allowUnknownFields(schema);
	allowUnknownFields((schema as JsonObjectSchema).properties?.metadata);
	return schema;
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
