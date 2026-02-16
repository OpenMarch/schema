# The OpenMarch Universal Standard

A documented, tested, and simple JSON schema for sharing and distributing data about a show in the marching arts. While this schema is maintained by the [OpenMarch](https://openmarch.com/) team, you don't have to write with OpenMarch to use this! With data from this schema, you can -

- Make your own reader app for marching band shows
- Create a drill-modification script that can import and export into other tools
- Develop a custom app for your band's needs (e.g. complex prop staging or light programming)

Think [MusicXML](https://www.musicxml.com/), but for coordinates of coordinates of performers!

> OpenMarch is an open-source drill writing software for marching bands.
> This schema defines the standardized data format for storing and exchanging drill show data, including performer positions, page timing, tempo changes, and field configuration.

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

### Tempo Data

### Beats

The `tempoSections` array contains a list of objects with a `tempo` and `numberOfBeats`.
This is the core of the tempo data that everything else is based on.

> **NOTE** - There is/should _always_ be a tempo section with a tempo of `0` and 1 beat at the start.
> This is because the first page always has no duration.

This is a simple example of tempo groups:

```json
{
  "tempoSections": [
    // First Page
    {
      "tempo": 0,
      "numberOfBeats": 1
    },
    // 8 bars of 120 BPM, assuming 4/4
    {
      "tempo": 120,
      "numberOfBeats": 32
    },
    // 30 bars of 120 BPM, assuming 4/4
    {
      "tempo": 144,
      "numberOfBeats": 120
    }
]}
```

#### Tempo Changes

During a tempo change, like an accelerando or ritardando, the tempo typically shifts gradually and then settles at the new tempo -

```json
{
  "tempoSections": [
    {
      "tempo": 0,
      "numberOfBeats": 1
    },
    {
      "tempo": 120,
      "numberOfBeats": 21
    },
    // Start ritardando
    {
      "tempo": 112,
      "numberOfBeats": 1
    },
    {
      "tempo": 104,
      "numberOfBeats": 1
    },
    {
      "tempo": 96,
      "numberOfBeats": 1
    },
    // Settle into new tempo
    {
      "tempo": 88,
      "numberOfBeats": 36
    }
]}
```

It is important to note that the tempo change may not always be exactly even like this.
It's up to the developer how much control they want to give the user, but from OpenMarch, tempos like this can be expected from a manual user entry -

```json
{
  "tempoSections": [
    {
      "tempo": 0,
      "numberOfBeats": 1
    },
    {
      "tempo": 120,
      "numberOfBeats": 20
    },
    // Start ritardando, unevenly
    {
      "tempo": 115,
      "numberOfBeats": 21
    },
    {
      "tempo": 106,
      "numberOfBeats": 1
    },
    {
      "tempo": 97,
      "numberOfBeats": 1
    },
    {
      "tempo": 92,
      "numberOfBeats": 1
    },
    // Settle into new tempo
    {
      "tempo": 88,
      "numberOfBeats": 36
    }
]}
```

### Measures

The `measures` array contains a list of objects with a `startBeatIndex`, `name`, and optionally `rehearsalMark`.
The index is from the 0-based index of the beats from `tempoSections`.
Note that since the first beat has a tempo of 0, we start the measures from index 1.

This is a simple example of six 4/4 measures -

```json
{
  "measures": [
    {
      "startBeatIndex": 1,
      "startBeatIndex": "Measure 1"
    },
    {
      "startBeatIndex": 5,
      "name": "Measure 2"
    },
    {
      "startBeatIndex": 9,
      "name": "Measure 3"
    },
    {
      "startBeatIndex": 13,
      "name": "Measure 4"
    },
    {
      "startBeatIndex": 17,
      "name": "Measure 5",
      // Optional rehearsal mark. Can be any string
      "rehearsalMark": "A"
    },
    {
      "startBeatIndex": 21,
      "name": "Measure 6"
    }
  ]}
```

Note how the `startBeatIndex`'s are spaced out by 4.
This is what makes the measures 4/4 in the _OpenMarch Universal Standard_!

For maximum flexibility, this schema does not enforce the concept of "time signatures."
Rather, it only denotes the tempo of beats + how many of those beats there are (`tempoSections`), and where the measures start `measures`.
From there the time signature can be _inferred_.

You may ask "How can I tell the difference between something like 3/4 and 3/2 then?"
The simple answer is - you don't.
This schema is not designed to be used in a notation software or DAW, but rather the simplest information needed for a marching arts show.

> If a designer wants to change a 4/4 measure to have steps on every half note, they should denote the measure as having two beats per measure.

#### Mixed meter

Mixed meters are supported in this schema, but they may look a bit strange at first glance.
Once you see a few examples, it's quite simple.

Say we have 4 measures of 4/4 at 120 BPM, then 4 bars of 7/8 (2+2+3) where the quarter note is 100 BPM -

```json
{
  "tempoSections": [
    // Starting empty beat
    {
      tempo: 0,
      numberOfBeats: 1
    },
    // 4 bars of 4/4
    // -- m1-m4
    {
      tempo: 120,
      numberOfBeats: 16
    },
    // 4 bars of 7/8, QN=100
    // -- m5
    {
      tempo: 100,
      numberOfBeats: 2
    },
    {
      tempo: 150,
      numberOfBeats: 1
    },
    // -- m6
    {
      tempo: 100,
      numberOfBeats: 2
    },
    {
      tempo: 150,
      numberOfBeats: 1
    },
    // -- m7
    {
      tempo: 100,
      numberOfBeats: 2
    },
    {
      tempo: 150,
      numberOfBeats: 1
    },
    // -- m8
    {
      tempo: 100,
      numberOfBeats: 2
    },
    {
      tempo: 150,
      numberOfBeats: 1
    }
  ],
  "measures": [
    {
      startBeatIndex: 1,
      name: "Measure 1"
    },
    {
      startBeatIndex: 5,
      name: "Measure 2"
    },
    {
      startBeatIndex: 9,
      name: "Measure 3"
    },
    {
      startBeatIndex: 13,
      name: "Measure 4"
    },
    // Start of 7/8
    {
      startBeatIndex: 17,
      name: "Measure 5"
    },
    // three beats after, since 7/8 is technically three "big beats"
    {
      startBeatIndex: 20,
      name: "Measure 6"
    },
    {
      startBeatIndex: 23,
      name: "Measure 7"
    },
    {
      startBeatIndex: 26,
      name: "Measure 8"
    },
  ]
}
```

When building a detector for if a measure is mixed meter or a tempo change, we use a two-step check. **A measure is mixed-meter when -**

- There are two distinct tempos in a measure - `t1` & `t2`
- The tempos have a relationship of `n * 1.5`
  - E.g. assuming `t1` is the shorter tempo - A measure is mixed meter given `t1 * 1.5 == t2`

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

## Development

```bash
bun install          # Install dependencies
bun test             # Run tests
bun run build        # Build to dist/
bun run generate-schema  # Regenerate schema.json and schema-tempo.json
```
