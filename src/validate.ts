import { z } from "zod";
import { OpenMarchSchema } from "./schema";
import type { OpenMarchSchema as OpenMarchSchemaType } from "./types";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Parse and validate a JSON string into a type-safe OpenMarchSchema object.
 * @param jsonString - The JSON string to parse and validate
 * @returns The parsed and validated OpenMarchSchema object
 * @throws {SyntaxError} If the JSON is invalid
 * @throws {z.ZodError} If the data doesn't match the schema
 */
export function parseOpenMarchSchema(jsonString: string): OpenMarchSchemaType {
  const data = JSON.parse(jsonString);
  return OpenMarchSchema.parse(data);
}

/**
 * Safely parse and validate a JSON string into a type-safe OpenMarchSchema object.
 * Returns a result object instead of throwing errors.
 * @param jsonString - The JSON string to parse and validate
 * @returns A result object with success status and either data or error
 */
export function safeParseOpenMarchSchema(
  jsonString: string
): ValidationResult<OpenMarchSchemaType> {
  try {
    const data = JSON.parse(jsonString);
    const result = OpenMarchSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "custom",
            path: [],
            message: `Invalid JSON: ${e.message}`,
          },
        ]),
      };
    }
    throw e;
  }
}

/**
 * Validate an already-parsed object against the OpenMarch schema.
 * @param data - The object to validate
 * @returns The validated OpenMarchSchema object
 * @throws {z.ZodError} If the data doesn't match the schema
 */
export function validateOpenMarchData(data: unknown): OpenMarchSchemaType {
  return OpenMarchSchema.parse(data);
}

/**
 * Safely validate an already-parsed object against the OpenMarch schema.
 * Returns a result object instead of throwing errors.
 * @param data - The object to validate
 * @returns A result object with success status and either data or error
 */
export function safeValidateOpenMarchData(
  data: unknown
): ValidationResult<OpenMarchSchemaType> {
  return OpenMarchSchema.safeParse(data);
}

/**
 * Check if data is a valid OpenMarch schema object.
 * Type guard function for use in conditionals.
 * @param data - The data to check
 * @returns True if the data is a valid OpenMarchSchema
 */
export function isValidOpenMarchData(data: unknown): data is OpenMarchSchemaType {
  return OpenMarchSchema.safeParse(data).success;
}

/**
 * Get human-readable validation error messages.
 * @param error - The ZodError to format
 * @returns An array of formatted error messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((e) => {
    const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
    return `${path}${e.message}`;
  });
}
