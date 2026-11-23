#!/usr/bin/env bun
/**
 * Regenerates src/exact-path/fixtures/core-parity.json: points that OpenMarch's
 * own copy of the exact-path format gives on shared paths, which this
 * package's tests must match.
 *
 * Run with the path to that copy and a note of where it came from:
 *   bun run scripts/generate-core-parity.ts <OpenMarch>/packages/core/src/timeline/exactPath.ts "commit abc1234"
 * (its `./types` import needs only `export type XY = readonly [number, number];`)
 */
import { resolve } from "node:path";
import type { ExactPath, XY } from "../src/exact-path";

const [corePath, note] = process.argv.slice(2);
if (!corePath || !note) {
	console.error(
		"usage: generate-core-parity.ts <path to core exactPath.ts> <source note>",
	);
	process.exit(1);
}
const core = (await import(resolve(corePath))) as {
	checkExactPath(p: ExactPath): unknown[];
	exactPointAt(p: ExactPath, tick: number): XY;
};
const { checkExactPath, exactPointAt } = core;

// seeded PRNG (mulberry32)
let seed = 1162;
const rnd = () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r = (a: number, b: number) =>
	Math.round((a + rnd() * (b - a)) * 1000) / 1000;
const xy = (): [number, number] => [r(-80, 80), r(0, 84)];

const named: Record<string, ExactPath> = {
	"QA-EP-1 points, quarter arc, cubic": {
		v: 1,
		from: [0, 0],
		shapes: [
			{
				kind: "points",
				points: [
					[3, 4],
					[3, 10],
					[6, 14],
				],
			},
			{ kind: "arc", to: [16, 24], bend: (Math.SQRT2 - 1) / 2 },
			{ kind: "cubic", c1: [20, 40], c2: [40, 0], to: [50, 24] },
		],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 4800, u: 5 },
		],
	},
	"QA-EP-2 peaked cubic": {
		v: 1,
		from: [0, 0],
		shapes: [{ kind: "cubic", c1: [0, 80], c2: [10, 80], to: [10, 0] }],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 960, u: 1 },
		],
	},
	"QA-EP-3 hold then walk": {
		v: 1,
		from: [0, 0],
		shapes: [{ kind: "points", points: [[20, 0]] }],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 960, u: 0 },
			{ tick: 1920, u: 1 },
		],
	},
	"QA-EP-3b corner": {
		v: 1,
		from: [0, 0],
		shapes: [
			{
				kind: "points",
				points: [
					[12, 0],
					[12, 12],
				],
			},
		],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 2880, u: 1 },
			{ tick: 3840, u: 2 },
		],
	},
	"QA-EP-3d cubic, arc, points": {
		v: 1,
		from: [0, 0],
		shapes: [
			{ kind: "cubic", c1: [10, 30], c2: [30, 30], to: [40, 0] },
			{ kind: "arc", to: [60, 0], bend: 0.3 },
			{ kind: "points", points: [[80, 10]] },
		],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 1000, u: 0.8 },
			{ tick: 1500, u: 1.5 },
			{ tick: 3000, u: 3 },
		],
	},
	"zero-length leg and negative half-turn arc": {
		v: 1,
		from: [5, 5],
		shapes: [
			{
				kind: "points",
				points: [
					[5, 5],
					[15, 5],
				],
			},
			{ kind: "arc", to: [25, 5], bend: -0.5 },
		],
		keys: [
			{ tick: 0, u: 0 },
			{ tick: 480, u: 0.5 },
			{ tick: 960, u: 2 },
			{ tick: 1440, u: 3 },
		],
	},
};

for (let n = 0; n < 12; n++) {
	const shapes: ExactPath["shapes"] = [];
	const count = 1 + Math.floor(rnd() * 4);
	let pieces = 0;
	for (let s = 0; s < count; s++) {
		const k = rnd();
		if (k < 0.34) {
			const pts = Array.from({ length: 1 + Math.floor(rnd() * 3) }, xy);
			shapes.push({ kind: "points", points: pts });
			pieces += pts.length;
		} else if (k < 0.67) {
			shapes.push({
				kind: "arc",
				to: xy(),
				bend: (rnd() < 0.5 ? -1 : 1) * r(0.05, 0.5),
			});
			pieces++;
		} else {
			shapes.push({ kind: "cubic", c1: xy(), c2: xy(), to: xy() });
			pieces++;
		}
	}
	const total = 480 * (4 + Math.floor(rnd() * 13));
	const inner = Math.floor(rnd() * 4);
	const ticks = [
		...new Set(
			Array.from({ length: inner }, () => 1 + Math.floor(rnd() * (total - 1))),
		),
	].sort((a, b) => a - b);
	const us = ticks
		.map(() => Math.round(rnd() * pieces * 1000) / 1000)
		.sort((a, b) => a - b);
	const keys = [{ tick: 0, u: 0 }];
	ticks.forEach((t, i) => {
		keys.push({ tick: t, u: us[i] as number });
	});
	keys.push({ tick: total, u: pieces });
	named[`random ${n}`] = { v: 1, from: xy(), shapes, keys };
}

const cases = Object.entries(named).map(([name, path]) => {
	const problems = checkExactPath(path);
	if (problems.length) throw new Error(`${name}: ${JSON.stringify(problems)}`);
	const last = (path.keys[path.keys.length - 1] as { tick: number }).tick;
	const ticks = new Set<number>();
	for (let i = 0; i <= 48; i++)
		ticks.add(Math.round(((last * i) / 48) * 4) / 4);
	for (const k of path.keys) ticks.add(k.tick);
	const samples = [...ticks]
		.sort((a, b) => a - b)
		.map((t) => [t, ...exactPointAt(path, t)]);
	return { name, path, samples };
});

const out = new URL(
	"../src/exact-path/fixtures/core-parity.json",
	import.meta.url,
).pathname;
await Bun.write(
	out,
	`${JSON.stringify({ source: `exactPointAt from OpenMarch packages/core/src/timeline/exactPath.ts (${note})`, cases }, null, "\t")}\n`,
);
console.log(`Wrote ${cases.length} cases to ${out}`);
