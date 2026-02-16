# OpenMarch Public Schema

OpenMarch is an open-source drill writing software for marching bands. This schema defines the standardized data format for storing and exchanging drill show data, including performer positions, page timing, tempo changes, and field configuration.

The schema follows a single-source-of-truth pattern where Zod schemas define all types, with TypeScript types automatically inferred.

## File Extensions

The OpenMarch Public Schema uses these file formats for saving and sharing shows:

| Extension | Name | Description |
| --------- | ---- | ----------- |
| `.om` | OpenMarch | Uncompressed JSON file containing show data |
| `.omz` | OpenMarch Zipped | Compressed JSON file for smaller file sizes |
| `.omt` | OpenMarch Tempo | Timing data only (metadata, pages, tempo, measures); no performers or coordinates |
| `.omp` | OpenMarch Package (Coming soon) | Compressed archive containing show data plus audio files and images |

> Note - the OpenMarch desktop app uses the `.dots` file extension which is not the same thing.
> A `.dots` an SQLite database file that is highly optimized for editing and interactivity.
> The [main OpenMarch repo](https://github.com/OpenMarch/OpenMarch) includes scripts for converting `.dots` files to-and-from `.om` files.

## Installation

```bash
npm install @openmarch/schema
```

## Usage

### Reading and writing files

The package supports both `.om` (raw JSON) and `.omz` (gzipped) formats. Format is detected automatically when reading.

**Reading** — pass file bytes as an `ArrayBuffer`; the reader decompresses gzip when needed and validates the result:

```typescript
import { fromOpenMarchSchemaFile } from '@openmarch/schema';

// Get bytes from your environment (e.g. Node, Bun, or browser)
const bytes = await file.arrayBuffer(); // or readFileSync(..., { encoding: null })
const schema = await fromOpenMarchSchemaFile(bytes);

// Access the data from the file
console.log(schema.performers, schema.coordinates);
```

**Writing** — use `toOpenMarchFile` with `compressed: false` for `.om` or `compressed: true` for `.omz`:

```typescript
import { toOpenMarchFile } from '@openmarch/schema';

const bytes = await toOpenMarchFile(schema, { compressed: true }); // .omz
// or
const bytes = await toOpenMarchFile(schema, { compressed: false }); // .om

// Write bytes with your environment's API (e.g. fs.writeFile, Bun.write, or Blob/File in browser)
await Bun.write('show.omz', bytes);
```

### Reading and writing OpenMarch Tempo (.omt) files

The `.omt` format stores only timing data (metadata, pages, tempo sections, optional measures). Use it when you need to share or edit timing without performer or coordinate data.

```typescript
import { fromOpenMarchTempoDataFile, toOpenMarchTempoDataFile } from '@openmarch/schema';

// Read .omt file (supports raw JSON or gzipped)
const bytes = await file.arrayBuffer();
const tempo = await fromOpenMarchTempoDataFile(bytes);

// Write .omt file
const out = await toOpenMarchTempoDataFile(tempo, { compressed: false });
await Bun.write('show.omt', out);
```

### Validating Show Data

```typescript
import { parseOpenMarch, safeParseOpenMarch, isOpenMarch } from '@openmarch/schema';

// Throws on invalid data
const show = parseOpenMarch(jsonData);

// Returns { success: true, data } or { success: false, error }
const result = safeParseOpenMarch(jsonData);

// Type guard
if (isOpenMarch(data)) {
  // data is typed as OpenMarch
}
```

### Using Types

```typescript
import type { OpenMarch, Performer, Page, Coordinate } from '@openmarch/schema';
```

### Accessing Schemas Directly

```typescript
import { OpenMarchSchema, PerformerSchema, PageSchema } from '@openmarch/schema';

// Use for custom validation logic
const performer = PerformerSchema.parse(data);
```

### Validating OpenMarch Tempo (.omt) data

```typescript
import {
  parseOpenMarchTempoDataSchema,
  safeParseOpenMarchTempoDataSchema,
  isValidOpenMarchTempoData,
} from '@openmarch/schema';

// Throws on invalid data
const tempo = parseOpenMarchTempoDataSchema(jsonString);

// Returns { success: true, data } or { success: false, error }
const result = safeParseOpenMarchTempoDataSchema(jsonString);

// Type guard
if (isValidOpenMarchTempoData(data)) {
  // data is typed as OpenMarchTempoData
}
```

### JSON Schema

Generated JSON Schemas are available at `schema.json` (full show) and `schema-tempo.json` (tempo-only) for use with other languages and tools.

## Schema Structure

The main `OpenMarchSchema` contains:

- **`omSchemaVersion`** - Schema version string for compatibility
- **`metadata`** - Show settings including performance area configuration
- **`performers`** - Marcher definitions (id, label, section, name)
- **`pages`** - Set/page definitions with timing and beat indices
- **`tempoSections`** - Tempo changes throughout the show
- **`coordinates`** - Marcher positions in steps from center/front
- **`measures`** - Optional measure markers with rehearsal marks

### OpenMarch Tempo (.omt)

The **OpenMarch Tempo** schema (`OpenMarchTempoDataSchema`) is a subset of the full schema that includes only timing-related data. It has the same field shapes and validation rules for those fields, but omits performers and coordinates.

- **`omSchemaVersion`** - Schema version string (same as full schema)
- **`metadata`** - Show settings including performance area configuration
- **`pages`** - Set/page definitions with timing and beat indices
- **`tempoSections`** - Tempo changes throughout the show
- **`measures`** - Optional measure markers with rehearsal marks

### Coordinate System

Coordinates use a step-based system.
The positive and negative directions are the same as an algebraic coordinate plane.

- `xSteps`: Horizontal position from center
  - (0 = 50 yard line, negative = audience's left)
- `ySteps`: Vertical position from the y-origin
  - Configurable as `0 = front sideline` or `0 = center`
  - Positive = towards back-field always
- `rotation_degrees`: Optional facing direction (0 = toward front sideline)

### Performance Area

The performance area defines the field layout including:

- Checkpoints for x/y axes (yard lines, hashes, sidelines)
- Step size in inches (e.g., 22.5" for 8-to-5)
- Field dimensions

## Development

```bash
bun install          # Install dependencies
bun test             # Run tests
bun run build        # Build to dist/
bun run generate-schema  # Regenerate schema.json and schema-tempo.json
```
