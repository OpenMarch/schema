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

When modifying the schema, edit `src/schema.ts` first, then run `bun run generate-schema` to update `schema.json`.

## Schema Structure

The main `OpenMarchSchema` contains:

- `metadata` - Show settings and performance area configuration
- `performers` - Marcher definitions (id, label, section)
- `pages` - Set/page definitions with timing
- `tempoSections` - Tempo changes throughout the show
- `coordinates` - Marcher positions (xSteps/ySteps from center/front)
- `measures` - Optional measure markers

## Bun Preferences

Use Bun instead of Node.js for all operations. See `node_modules/bun-types/docs/**.mdx` for API documentation.