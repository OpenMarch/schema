#!/usr/bin/env bun
/**
 * CLI script to validate OpenMarch JSON files.
 *
 * Usage:
 *   bun run ./scripts/validate.ts <file.json>
 *   bun run ./scripts/validate.ts --stdin < file.json
 */

import { safeParseOpenMarchSchema, formatValidationErrors } from "../src/validate";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun run ./scripts/validate.ts <file.json>");
    console.error("       bun run ./scripts/validate.ts --stdin < file.json");
    process.exit(1);
  }

  let jsonString: string;

  if (args[0] === "--stdin") {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    jsonString = Buffer.concat(chunks).toString("utf-8");
  } else {
    // Read from file
    const filePath = args[0];
    if (!filePath) {
      console.error("Error: No file path provided");
      process.exit(1);
    }
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    jsonString = await file.text();
  }

  const result = safeParseOpenMarchSchema(jsonString);

  if (result.success) {
    console.log("Validation successful!");
    console.log(`- Schema version: ${result.data.omSchemaVersion}`);
    console.log(`- Performers: ${result.data.performers.length}`);
    console.log(`- Pages: ${result.data.pages.length}`);
    console.log(`- Coordinates: ${result.data.coordinates.length}`);
    console.log(`- Tempo sections: ${result.data.tempoSections.length}`);
    if (result.data.measures) {
      console.log(`- Measures: ${result.data.measures.length}`);
    }
    process.exit(0);
  } else {
    console.error("Validation failed:");
    const errors = formatValidationErrors(result.error);
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}

main();
