# Example files

## Exact paths in `.om`

`exact-paths.om` is a `.om` show with `exactPaths`: three marchers over three sets. Marcher 1 walks a half circle into set 2, then holds for 2 counts and walks a corner into set 3 (one path, with a hold inside it). Marcher 2 walks a cubic curve into set 2, then stands on set 2 for 4 counts, which no path covers, and walks an arc into set 3 over the last 4. Marcher 3 has no exact paths, so a reader draws straight lines. The tests check that it validates and that each path starts and ends on the marcher's sets.

## Example `.ompb` files

Valid OpenMarch playback files for testing a reader, such as the mobile app. Each show comes as a gzipped `.ompb` file, as an app would receive it, and a readable `.json` copy with the same data. The [format spec](https://github.com/OpenMarch/schema/issues/1) describes every field.

These are generated from `src/playback/examples.ts` with `bun run generate-examples`, and the tests check that they still pass the checker and match their builders.

| File | What it covers |
| ---- | -------------- |
| `basic` | The spec's example as a whole show: a straight move into set 2, a curved move into set 4 (with its drawing), holds, two tempos, an individual appearance, and 4 beats of music after the last set. |
| `set-one-counts` | Set 1 with 4 counts before set 2's walk (everyone holds on set 1), a move split by a step-rate change (one step per count, then double time), triplets on a subset page (`Set 2A`), a section appearance with a `square` shape, and a 2-beat measure. |
| `large-show` | 24 marchers over 10 walking pages of 16 counts, with two tempos. Half-circle curves are written as 48 straight sections each (within 1/100 of a step of the true curve) and drawn as two cubic Bézier curves. A slide followed directly by a curve is one move with a point at the page boundary. |

Things a reader most often gets wrong, all exercised here:

- **Page order is list order.** Set 1 and set 2 share `startBeatIndex` 0, so never sort pages by it.
- **A page's counts are the walk *into* that set.** Marchers are on set N at `startBeatIndex + counts`, and set N's drawing is the walk into it.
- **Positions come from `moves`, never from drawings.** Blend in a straight line between the two points around a tick.
- **y points toward the back of the field** (away from the front sideline when `yOrigin` is `front`). A reader drawing in SVG, where y points down, flips it.
