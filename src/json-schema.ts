import { z } from "zod";
import { OpenMarchSchema } from "./schema";

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
