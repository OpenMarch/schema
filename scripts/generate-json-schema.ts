#!/usr/bin/env bun
/**
 * Script to generate the JSON Schema file from Zod schemas.
 * Run with: bun run generate-schema
 */

import {
	getJsonSchemaString,
	getOpenMarchTempoJsonSchemaString,
} from "../src/json-schema";

const schemaPath = new URL("../schema.json", import.meta.url).pathname;
const schemaContent = getJsonSchemaString(2);
await Bun.write(schemaPath, schemaContent);
console.log(`JSON Schema written to: ${schemaPath}`);

const schemaTempoPath = new URL("../schema-tempo.json", import.meta.url)
	.pathname;
const schemaTempoContent = getOpenMarchTempoJsonSchemaString(2);
await Bun.write(schemaTempoPath, schemaTempoContent);
console.log(`JSON Schema (tempo) written to: ${schemaTempoPath}`);
