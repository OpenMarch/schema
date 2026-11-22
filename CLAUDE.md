# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **@openmarch/schema**, a Zod-based schema library for validating OpenMarch marching band drill show data. It provides:

- Zod schemas for runtime validation
- TypeScript types inferred from schemas
- JSON Schema generation for cross-language compatibility

## Commands

```bash
bun install          # Install dependencies
bun test             # Run all tests
bun run build        # Build to dist/
bun run build:types  # Generate TypeScript declarations
bun run generate-schema  # Regenerate schema.json from Zod schemas
```

## Architecture

The codebase follows a single-source-of-truth pattern where Zod schemas define everything:

- **`src/schema.ts`** - Zod schema definitions (source of truth for all types)
- **`src/types.ts`** - TypeScript types inferred from Zod schemas via `z.infer<>`
- **`src/validate.ts`** - Validation utilities (parse, safeParse, type guards)
- **`src/json-schema.ts`** - JSON Schema generation using `z.toJSONSchema()`
- **`src/index.ts`** - Public API exports
- **`src/playback/`** - The `.ompb` playback format: its own schema with its own copies of shared `.om` parts (`schema.ts`), version rules (`version.ts`), the checker for rules a shape can't express, with a stable code per problem (`check.ts`), and validation and file helpers (`validate.ts`). `index.ts` is the deliberately small public API. The JSON Schema is generated from the shape alone.
- **`src/exact-path/`** - Exact paths, the optional `exactPaths` field of `.om` (OpenMarch ADR 0018, timeline spec Appendix M): the format, its rules EP-1 to EP-6 and the player EP-R (`exactPath.ts`, the shared copy that OpenMarch imports, so keep it in step with the spec), the Zod schemas and placement rules EP-P1 to EP-P3 (`schema.ts`), and a whole-show reader by marcher and tick (`reader.ts`). `fixtures/core-parity.json` holds points from OpenMarch's own copy, which the tests must match. The types are written by hand (with readonly points, as OpenMarch uses them); the schema file checks that parsed data fits them.

When modifying the schema, edit `src/schema.ts` first, then run `bun run generate-schema` to update `schema.json`.

## Schema Structure

The main `OpenMarchSchema` contains:

- `metadata` - Show settings and performance area configuration
- `performers` - Marcher definitions (id, label, section)
- `pages` - Set/page definitions with timing
- `tempoSections` - Tempo changes throughout the show
- `coordinates` - Marcher positions (xSteps/ySteps from center/front)
- `measures` - Optional measure markers
- `exactPaths` - Optional exact paths: a marcher's real walk during a move, placed by start and end tick

## Bun Preferences

Use Bun instead of Node.js for all operations. See `node_modules/bun-types/docs/**.mdx` for API documentation.