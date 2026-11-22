/**
 * Exact paths in a `.om` show: the optional `exactPaths` field, its placement
 * rules (EP-P1 to EP-P3), old files and old readers, playing a show by tick,
 * and the example file.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { z } from "zod";
import {
	createExactPathReader,
	type ExactPath,
	type ExactPathEntry,
	exactPointAt,
	fromOpenMarchSchemaFile,
	OpenMarchSchema,
	SCHEMA_VERSION,
	safeValidateOpenMarchData,
	TICKS_PER_BEAT,
	tempoSectionsToBeats,
	toOpenMarchFile,
	type XY,
} from "../index";

const example = JSON.parse(
	readFileSync(
		new URL("../../examples/exact-paths.om", import.meta.url),
		"utf8",
	),
);

const walk: ExactPath = {
	v: 1,
	from: [0, 0],
	shapes: [{ kind: "points", points: [[8, 0]] }],
	keys: [
		{ tick: 0, u: 0 },
		{ tick: 960, u: 1 },
	],
};

const entry = (over: Partial<ExactPathEntry> = {}): ExactPathEntry => ({
	marcherId: "1",
	startTick: 480,
	endTick: 1440,
	path: walk,
	...over,
});

/** The example show with its exact paths replaced. */
const withPaths = (exactPaths: unknown) => ({ ...example, exactPaths });

const issuesOf = (data: unknown) => {
	const result = safeValidateOpenMarchData(data);
	if (result.success) return [];
	return result.error.issues.map((i) => ({
		path: i.path.join("."),
		rule: (i as { params?: { rule?: string } }).params?.rule,
		message: i.message,
	}));
};

describe("the exactPaths field", () => {
	it("the schema version is bumped for it", () => {
		expect(SCHEMA_VERSION).toBe("0.3.0");
	});

	it("is optional: a show without it is valid, as before", () => {
		const { exactPaths: _, ...old } = example;
		expect(issuesOf(old)).toEqual([]);
		expect(OpenMarchSchema.parse(old).exactPaths).toBeUndefined();
	});

	it("survives a write and a read, in .om and .omz", async () => {
		const show = OpenMarchSchema.parse(example);
		for (const compressed of [false, true]) {
			const bytes = await toOpenMarchFile(show, { compressed });
			const back = await fromOpenMarchSchemaFile(bytes.slice().buffer);
			expect(back.exactPaths).toEqual(show.exactPaths);
		}
	});

	it("a reader that doesn't know the field ignores it and reads the rest", () => {
		// what an older version of this package does: unknown fields are dropped
		const older = OpenMarchSchema.omit({ exactPaths: true });
		const read = older.parse(example) as z.output<typeof older> & {
			exactPaths?: unknown;
		};
		expect(read.exactPaths).toBeUndefined();
		expect(read.coordinates).toEqual(example.coordinates);
	});

	it("each broken path rule is reported with its id and where it is", () => {
		const issues = issuesOf(
			withPaths([
				entry({
					path: { ...walk, shapes: [{ kind: "arc", to: [8, 0], bend: 0.7 }] },
				}),
			]),
		);
		expect(issues).toEqual([
			{
				path: "exactPaths.0.path.shapes.0.bend",
				rule: "EP-3",
				message: "EP-3: arc 0 has bend 0.7, outside 0 < |bend| ≤ 1/2",
			},
		]);
	});

	it("rules the shape alone catches still name EP-1", () => {
		const issues = issuesOf(
			withPaths([entry({ path: { ...walk, v: 2 as 1 } })]),
		);
		expect(issues.map((i) => [i.path, i.message])).toEqual([
			["exactPaths.0.path.v", "EP-1: v must be 1"],
		]);
	});
});

describe("placing exact paths in time (EP-P1 to EP-P3)", () => {
	const rulesOf = (entries: ExactPathEntry[]) =>
		issuesOf(withPaths(entries)).map((i) => [i.rule, i.path]);

	it("EP-P1: startTick is a whole number, 0 or more", () => {
		expect(rulesOf([entry({ startTick: 480.5, endTick: 1440.5 })])).toEqual([
			["EP-P1", "exactPaths.0.startTick"],
		]);
		expect(rulesOf([entry({ startTick: -480, endTick: 480 })])).toEqual([
			["EP-P1", "exactPaths.0.startTick"],
		]);
		expect(rulesOf([entry({ startTick: 0, endTick: 960 })])).toEqual([]);
	});

	it("EP-P2: endTick is startTick plus the path's last key tick", () => {
		expect(rulesOf([entry({ endTick: 1400 })])).toEqual([
			["EP-P2", "exactPaths.0.endTick"],
		]);
	});

	it("EP-P3: one marcher's paths don't overlap; touching is fine", () => {
		expect(
			rulesOf([
				entry({ startTick: 1440, endTick: 2400 }),
				entry({ startTick: 480, endTick: 1440 }),
				entry({ marcherId: "2", startTick: 960, endTick: 1920 }),
			]),
		).toEqual([]);
		expect(
			rulesOf([entry(), entry({ startTick: 1000, endTick: 1960 })]),
		).toEqual([["EP-P3", "exactPaths.1.startTick"]]);
	});
});

describe("playing a show's exact paths", () => {
	const reader = createExactPathReader([
		entry(),
		entry({
			startTick: 1440,
			endTick: 2400,
			path: {
				...walk,
				from: [8, 0],
				shapes: [{ kind: "points", points: [[8, 8]] }],
			},
		}),
	]);

	it("plays by show tick, from the path's own start", () => {
		expect(reader.positionAt("1", 480)).toEqual([0, 0]);
		expect(reader.positionAt("1", 960)).toEqual([4, 0]);
		expect(reader.positionAt("1", 1920)).toEqual([8, 4]);
		expect(reader.positionAt("1", 2400)).toEqual([8, 8]);
	});

	it("says nothing outside its paths, so the reader draws straight lines", () => {
		expect(reader.positionAt("1", 479)).toBeUndefined();
		expect(reader.positionAt("1", 2401)).toBeUndefined();
		expect(reader.positionAt("2", 960)).toBeUndefined();
	});

	it("where one path ends on the tick the next starts, the next answers", () => {
		expect(reader.positionAt("1", 1440)).toEqual([8, 0]);
	});
});

describe("the example file (examples/exact-paths.om)", () => {
	const show = OpenMarchSchema.parse(example);
	const pages = show.pages;
	const spot = (marcherId: string, pageId: string): XY => {
		const c = show.coordinates.find(
			(c) => c.marcherId === marcherId && c.pageId === pageId,
		);
		if (!c) throw new Error(`no spot for ${marcherId} on ${pageId}`);
		return [c.xSteps, c.ySteps];
	};

	it("is valid and has each kind of shape", () => {
		expect(issuesOf(example)).toEqual([]);
		const kinds = new Set(
			show.exactPaths?.flatMap((e) => e.path.shapes.map((s) => s.kind)),
		);
		expect([...kinds].sort()).toEqual(["arc", "cubic", "points"]);
	});

	it("each path walks from one set to the next, over that page's counts", () => {
		for (const e of show.exactPaths ?? []) {
			// the walk into page i starts on its first beat and ends where the next
			// page starts (or, for the last page, on the show's last beat)
			const i = pages.findIndex(
				(p) => p.startBeatIndex * TICKS_PER_BEAT === e.startTick,
			);
			const page = pages[i];
			const before = pages[i - 1];
			const after = pages[i + 1];
			if (!page || !before) throw new Error("no page for the path");
			const endBeat = after
				? after.startBeatIndex
				: tempoSectionsToBeats(show.tempoSections).length;
			expect(e.endTick).toBe(endBeat * TICKS_PER_BEAT);
			const length = e.endTick - e.startTick;
			expect(exactPointAt(e.path, 0)).toEqual(spot(e.marcherId, before.id));
			expect(exactPointAt(e.path, length)).toEqual(spot(e.marcherId, page.id));
		}
	});

	it("the arc bows toward the back of the field, as y up says", () => {
		const reader = createExactPathReader(show.exactPaths ?? []);
		// marcher 1 walks a half circle from (−8, 20) to (8, 20); halfway is (0, 28)
		const mid = reader.positionAt("1", 480 + 1920) as XY;
		expect(Math.hypot(mid[0], mid[1] - 28)).toBeLessThan(1e-12);
	});
});
