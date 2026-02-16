import { z } from "zod";
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
