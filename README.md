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
- **`exactPaths`** - Optional (since schema `0.3.0`): the real walk of a marcher during a move, curves included. See [Exact paths](#exact-paths)

### OpenMarch Tempo (.omt)

The **OpenMarch Tempo** schema (`OpenMarchTempoDataSchema`) is a subset of the full schema that includes only timing-related data. It has the same field shapes and validation rules for those fields, but omits performers and coordinates.

- **`omSchemaVersion`** - Schema version string (same as full schema)
- **`metadata`** - Show settings including performance area configuration
- **`pages`** - Set/page definitions with timing and beat indices
- **`tempoSections`** - Tempo changes throughout the show
- **`measures`** - Optional measure markers with rehearsal marks

### OpenMarch Playback (.ompb)

> **Experimental.** `.ompb` may change or be retired: OpenMarch may instead add exact curved paths to `.om`, which would let viewer apps read `.om` directly. Don't rely on it in released apps yet. See [issue #1](https://github.com/OpenMarch/schema/issues/1).

The **OpenMarch Playback** schema (`OpenMarchPlaybackSchema`) is the playback copy of a show, for viewer apps. Everything is worked out ahead of time by the exporter, so a reader needs only lookups and straight-line blending between points. It describes the real motion, including curved paths, which `.om` can't. It is never edited, always gzip-compressed, and has its own version field. The full design is in [issue #1](https://github.com/OpenMarch/schema/issues/1).

- **`ompbVersion`** - Playback format version, separate from `omSchemaVersion`
- **`ticksPerBeat`** - Each beat is split into this many ticks (the exporter writes 480); every time in `moves` is a whole number of ticks
- **`metadata`**, **`performers`**, **`performerAppearance`**, **`tempoSections`**, **`measures`** - As in `.om`, except marcher IDs are text everywhere and there is no zero-length first beat (beat 0 is the first counted beat, and every tempo is above 0)
- **`pages`** - In show order. Each page has `startBeatIndex` and `counts`, the counts to get to that set, and `paths`, an SVG drawing per marcher of the walk into that set, for display only
- **`moves`** - Each marcher's motion for the whole show: `ticks` and interleaved `xy` points in field steps, straight lines at an even speed between points, plus an optional `ticksPerStep` step rate

Validating `.ompb` data also runs the checker, which enforces the rules a shape can't express: each marcher's moves cover the whole show end to end with no gaps, overlaps or jumps; every page start and end is a point; marchers hold on set 1 during any counts it has, and after the last set; the first page has no drawings; drawings start and end within 0.02 of a step (straight-line distance) of the marcher's points; pages chain together; measures are in order; and every ID refers to something real.

`.ompb` has its own copies of the parts it shares with `.om`, so changing `.om` never changes it. Display-only options that may grow (such as a marcher's `shape`) accept any text, and readers fall back for values they don't know. Fields the exporter always writes are required, so readers never need defaults. Unknown fields are allowed but dropped when read, so a tool that rewrites a file with an older package loses fields it doesn't know.

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

### Exact paths

`exactPaths` (optional, since schema `0.3.0`) stores how a marcher really walks during a move, curves and speed changes included, so a reader can play a show exactly as OpenMarch does without OpenMarch's path engine. Readers that don't know the field draw straight lines between sets, as before. Files without the field are unchanged and still valid.

Where the marcher is, page by page (a page is the walk into a set, from its `startBeatIndex` to the next page's):

- **A page with an exact path for the marcher:** between a path's `startTick` and `endTick` the marcher follows it. On the page's other counts the marcher **stands still**: at the end of the path before, or, before the page's first path, at that path's start. OpenMarch writes no path for a hold, so "4 counts in place, then a 4-count curve" is one path over the last 4 counts.
- **A page with no exact path for the marcher:** a straight line between the sets, as before.

The format comes from OpenMarch's ADR 0018 and the rules (EP-1 to EP-6, EP-R) from its timeline spec, Appendix M. This package is the shared copy: use its functions instead of writing the math yourself.

```json
{
  "exactPaths": [
    {
      "marcherId": "1",
      "startTick": 480,
      "endTick": 4320,
      "path": {
        "v": 1,
        "from": [-8, 20],
        "shapes": [{ "kind": "arc", "to": [8, 20], "bend": 0.5 }],
        "keys": [{ "tick": 0, "u": 0 }, { "tick": 3840, "u": 1 }]
      }
    }
  ]
}
```

#### Placing a path in time

Each entry belongs to one marcher (`marcherId`, the same ids as `coordinates`) and carries its own **start and end tick**. It isn't tied to a page: when a page boundary moves, the path itself stays where it is in time. Which counts around it are holds can change, though, since that depends on which page they fall in (see above).

- There are **480 ticks per beat** (`TICKS_PER_BEAT`), the MIDI PPQ that DAWs use.
- Ticks count from the start of the show, on the same beat scale as `startBeatIndex`: beat `b` is tick `b × 480`. A walk into a page usually starts at `startBeatIndex × 480` and ends where the next page starts.
- The path's own key ticks count from `startTick`, so `endTick` is `startTick` plus the last key's tick.
- A path may start or end anywhere, even in another page than the one it starts in. Its first point is where the marcher is when it starts, and its last where the marcher is when it ends.

#### The path

A path starts at `from` and continues through `shapes`, each starting where the last one ended:

- **`points`**: straight lines through a list of points. Each point is a corner; a single straight leg is a list of one point.
- **`arc`**: a circular arc to `to`. `bend` is the signed sagitta over the chord: the arc's middle is `M + bend·c·n`, with `M` the chord's midpoint, `c` its length and `n = (−dy, dx)/c` the chord direction turned +90°. With `.om`'s y up the field, a positive `bend` on a chord along +x bows toward the back. `0 < |bend| ≤ 1/2`, so at most a half turn.
- **`cubic`**: a cubic Bézier curve to `to`, through the controls `c1` and `c2`.

Every straight leg, arc and cubic is one **piece**, counted from 0 across the path. **`keys`** say when the marcher is where: at `tick` the marcher is at place `u`, the piece number plus the share of that piece's length (`1.5` is halfway along the second piece; the end is the number of pieces). Between keys the marcher walks at a steady speed, measured along the real curve: a cubic by its true length, not by its Bézier parameter. Two keys with the same `u` are a hold.

#### Coordinates and arcs

Points are in steps on the same axes as `coordinates`: x from the center of the field (negative toward the audience's left), y from the y-origin toward the back of the field. That y points *up* the field, the opposite of OpenMarch's on-screen y and of SVG. When converting to y-down, negate each y **and each arc's `bend`**: flipping y mirrors the side the arc bows to.

#### Rules

Validating a show applies these rules. Each break of a rule has a message starting with the rule's id, and its `path` points at the field. Problems found by the rule checks also carry `params.rule`. Data of the wrong shape (a missing field, an unknown `kind`, a point that isn't `[x, y]`) gets Zod's usual shape errors. `schema.json` carries the limits a JSON Schema can express (lengths, whole ticks, the `bend` range); the rest need this package.

| Rule | |
| --- | --- |
| EP-1 | Every coordinate, `bend`, `tick` and `u` is a finite number; `v` is 1. |
| EP-2 | A path has at least one shape; a `points` shape has at least one point. A repeated point is a leg of length 0. |
| EP-3 | An arc has `0 < \|bend\| ≤ 1/2` and doesn't end where it starts. |
| EP-4 | A cubic's length is its true arc length. |
| EP-5 | At least two keys. The first is `{tick: 0, u: 0}`; the last key's `u` is the number of pieces. Ticks are whole and strictly increase; `u` never decreases. |
| EP-6 | The path goes somewhere: its length is at least 10⁻⁹ (`EXACT_MIN_LENGTH`) and finite. |
| EP-P1 | `startTick` is a whole number, 0 or more. |
| EP-P2 | `endTick` is `startTick` plus the last key's tick. |
| EP-P3 | One marcher's paths don't overlap in time. One may start on the tick another ends. |

`checkExactPath(path)` returns a single path's problems as `{ rule, message, path }`.

#### Changing the format later

`v` stays `1`, and the shapes stay `points`, `arc` and `cubic`. A 0.5.0 reader refuses a whole show whose exact paths break a rule, including an unknown `v` or `kind`, so an incompatible change would lock today's readers out of the show. Such a change goes in a **new top-level field** instead, which today's readers drop while still reading `exactPaths`. Validation stays strict, so a writer's mistake is caught rather than silently ignored.

#### Playing paths

```typescript
import { createExactPathReader, exactPlayer, TICKS_PER_BEAT } from '@openmarch/schema';

// A whole show: by marcher and show tick (fractional ticks are fine).
// Follows the paths and stands still on a page's uncovered counts.
const reader = createExactPathReader(show);
const xy = reader.positionAt('1', beat * TICKS_PER_BEAT); // [x, y], or undefined: no path this page, draw a straight line

// One path: ticks from the path's own start
for (const entry of show.exactPaths ?? []) {
  const player = exactPlayer(entry.path);
  player.pointAt(1920);
}
```

Building a player measures the path, so build it once and call `pointAt` for each frame. `createExactPathReader` does this for you.

[`examples/exact-paths.om`](examples/exact-paths.om) has a show with one path of each shape, a hold inside a path, a path that starts after 4 counts standing still, and a marcher with no exact paths.

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
| `.ompb` | OpenMarch Playback | Gzipped playback copy of a show for viewer apps: per-marcher moves and per-page path drawings |
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

### Reading and writing OpenMarch Playback (.ompb) files

`.ompb` files are always gzipped when written. Reading detects gzip, so plain JSON also works. Both directions validate against the schema and every checker rule, so a file that breaks a rule is never written.

```typescript
import { fromOpenMarchPlaybackFile, toOpenMarchPlaybackFile } from '@openmarch/schema';

const playback = await fromOpenMarchPlaybackFile(await file.arrayBuffer());

const bytes = await toOpenMarchPlaybackFile(playback);
await Bun.write('show.ompb', bytes);
```

[`examples/`](examples/) has valid `.ompb` files (gzipped, plus a readable `.json` copy of each) for testing a reader in any language.

To check data without throwing, use `safeValidateOpenMarchPlaybackData(data)`. It returns `{ success: true, data }` or `{ success: false, issues }`, where each issue has a stable `code` (such as `coverage.gap` or `point.missingAtPage`), a `path` into the file, a `message`, and the `marcherId` when the problem is about one marcher. Match on `code`, not on `message`. The throwing functions throw a `PlaybackValidationError` with the same `issues`.

```typescript
import { safeValidateOpenMarchPlaybackData } from '@openmarch/schema';

const result = safeValidateOpenMarchPlaybackData(data);
if (!result.success) {
  for (const issue of result.issues) console.log(issue.code, issue.marcherId, issue.message);
}
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

Generated JSON Schemas are available at `schema.json` (full show), `schema-tempo.json` (tempo-only) and `schema-playback.json` (`.ompb`) for use with other languages and tools. `schema-playback.json` describes the shape only: the checker's rules need this package.

`schema.json` and `schema-tempo.json` allow fields they don't know at the top level (and, for tempo, in `metadata`), as this package's reader does, so files from a newer version still validate. Fields inside known objects stay strict.

## Development

```bash
bun install          # Install dependencies
bun test             # Run tests
bun run build        # Build to dist/
bun run generate-schema  # Regenerate schema.json, schema-tempo.json and schema-playback.json
bun run generate-examples  # Regenerate the example .ompb files in examples/
```
