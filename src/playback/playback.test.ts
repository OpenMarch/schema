import { describe, expect, test } from "bun:test";
import * as publicApi from "../index";
import {
	fromOpenMarchPlaybackFile,
	getOpenMarchPlaybackJsonSchema,
	isSupportedPlaybackVersion,
	type OpenMarchPlaybackData,
	OpenMarchPlaybackSchema,
	type PlaybackIssue,
	PlaybackValidationError,
	safeValidateOpenMarchPlaybackData,
	toOpenMarchPlaybackFile,
	validateOpenMarchPlaybackData,
} from "../index";
import {
	MAX_PLAYBACK_ISSUES,
	MAX_PLAYBACK_ISSUES_PER_CODE,
	PlaybackIssueList,
} from "./check";
import { basicExample } from "./examples";
import { PLAYBACK_PATH_REGEX } from "./schema";

/** The example from the format's issue, filled out to a whole show. */
const validPlayback = basicExample;

type Move = OpenMarchPlaybackData["moves"][number];
type Page = OpenMarchPlaybackData["pages"][number];

const move = (data: OpenMarchPlaybackData, i: number) => data.moves[i] as Move;
const page = (data: OpenMarchPlaybackData, i: number) => data.pages[i] as Page;

/** Validate and return the error messages (empty when valid). */
function problems(data: unknown): string[] {
	const result = safeValidateOpenMarchPlaybackData(data);
	return result.success ? [] : result.issues.map((i) => i.message);
}

/** Validate and return the problems in full (empty when valid). */
function issuesOf(data: unknown): PlaybackIssue[] {
	const result = safeValidateOpenMarchPlaybackData(data);
	return result.success ? [] : result.issues;
}

/** Expect exactly one problem, containing `text`, at `path`; returns it. */
function expectOneProblem(
	data: unknown,
	text: string,
	path?: (string | number)[],
): PlaybackIssue | undefined {
	const result = safeValidateOpenMarchPlaybackData(data);
	expect(result.success).toBe(false);
	if (result.success) return undefined;
	expect(result.issues.map((i) => i.message)).toEqual([
		expect.stringContaining(text),
	]);
	if (path) expect(result.issues[0]?.path).toEqual(path);
	return result.issues[0];
}

describe("valid playback data", () => {
	test("the example show is valid", () => {
		expect(problems(validPlayback())).toEqual([]);
	});

	test("a newer patch version may add display-only options, like a shape", () => {
		const data = { ...validPlayback(), ompbVersion: "0.1.1" };
		const appearance = data.performerAppearance?.performers?.[0];
		if (!appearance) throw new Error("fixture has an appearance");
		appearance.shape = "diamond";
		expect(problems(data)).toEqual([]);
	});

	test("unknown fields are ignored", () => {
		const data = { ...validPlayback(), futureField: 1 };
		(page(data, 1) as Record<string, unknown>).facing = { "7": 90 };
		expect(problems(data)).toEqual([]);
	});

	test("set 1 may have counts before set 2's walk, which belong to set 1", () => {
		const data = validPlayback();
		// Set 1 gets 2 counts; set 2's walk shifts to beats 2..8 (6 counts).
		page(data, 0).counts = 2;
		page(data, 1).startBeatIndex = 2;
		page(data, 1).counts = 6;
		move(data, 1).ticks = [0, 960, 3840];
		move(data, 1).xy = [0, 0, 0, 0, 8, 0];
		// Set 1 now ends at tick 960, so marcher 12 needs a point there too.
		move(data, 0).ticks = [0, 960, 3840, 7680];
		move(data, 0).xy = [4, 10, 4, 10, 4, 10, 4, 10];
		expect(problems(data)).toEqual([]);
	});

	test("a drawing for a marcher who moves for only part of the counts", () => {
		const data = validPlayback();
		// Marcher 7 holds for 4 counts, then walks 4: the drawing covers the walk.
		move(data, 1).ticks = [0, 1920, 3840];
		move(data, 1).xy = [0, 0, 0, 0, 8, 0];
		expect(problems(data)).toEqual([]);
	});

	test("two points may share a tick at the same position", () => {
		const data = validPlayback();
		move(data, 0).ticks = [0, 3840, 3840, 7680];
		move(data, 0).xy = [4, 10, 4, 10, 4, 10, 4, 10];
		expect(problems(data)).toEqual([]);
	});

	test("drawing ends may be up to 0.02 of a step off", () => {
		const data = validPlayback();
		page(data, 1).paths = { "7": "M 0.02 0 L 8 -0.02" };
		expect(problems(data)).toEqual([]);
	});
});

describe("shape", () => {
	test("tempo must be above 0", () => {
		const data = validPlayback();
		data.tempoSections.unshift({ tempo: 0, numberOfBeats: 1 });
		expect(problems(data).length).toBeGreaterThan(0);
	});

	test("ticks must be whole numbers", () => {
		const data = validPlayback();
		move(data, 0).ticks = [0, 3840.5, 7680];
		expect(problems(data).length).toBeGreaterThan(0);
	});

	test("page counts and starts must be whole numbers", () => {
		const data = validPlayback();
		page(data, 2).counts = 7.5;
		expect(problems(data).length).toBeGreaterThan(0);
	});

	test("ticksPerStep must be a whole number above 0", () => {
		for (const ticksPerStep of [0, -480, 160.5]) {
			const data = validPlayback();
			move(data, 1).ticksPerStep = ticksPerStep;
			expect(problems(data).length).toBeGreaterThan(0);
		}
	});

	test("xy must hold one pair per tick", () => {
		const data = validPlayback();
		move(data, 1).xy = [0, 0, 8];
		expectOneProblem(data, "one x, y pair per tick", ["moves", 1, "xy"]);
	});

	test("a move needs at least two points", () => {
		const data = validPlayback();
		move(data, 1).ticks = [0];
		move(data, 1).xy = [0, 0];
		expect(problems(data).length).toBeGreaterThan(0);
	});

	test("there must be at least one page", () => {
		const data = validPlayback();
		data.pages = [];
		expect(problems(data).length).toBeGreaterThan(0);
	});

	test("fields the exporter always writes are required", () => {
		const noPaths = validPlayback();
		delete (page(noPaths, 2) as { paths?: unknown }).paths;
		expect(issuesOf(noPaths)).toEqual([
			expect.objectContaining({ code: "shape", path: ["pages", 2, "paths"] }),
		]);

		const noStrokeWidth = validPlayback();
		const appearance = noStrokeWidth.performerAppearance?.performers?.[0];
		delete (appearance as { strokeWidth?: unknown }).strokeWidth;
		expect(issuesOf(noStrokeWidth)).toEqual([
			expect.objectContaining({ code: "shape" }),
		]);
	});

	test("a new y origin changes what positions mean, so it is refused", () => {
		const data = validPlayback();
		(data.metadata.performanceArea as { yOrigin: string }).yOrigin = "back";
		expect(issuesOf(data)).toEqual([
			expect.objectContaining({ code: "shape" }),
		]);
	});

	test("marcher IDs are text", () => {
		const data = validPlayback();
		(data.performers[0] as { id: unknown }).id = 12;
		expect(problems(data).length).toBeGreaterThan(0);
	});
});

describe("path strings", () => {
	const valid = [
		"M 0 0",
		"M 4 10 C 6 14 10 16 12 14",
		"M -1.5 2 L 3 4 C 5 6 7 8 9 10 L 0.25 -0.75",
	];
	const invalid = [
		"",
		"L 0 0",
		"M 0 0 M 1 1",
		"m 0 0",
		"M 0 0 l 1 1",
		"M 0 0 L 1 1 2 2",
		"M 0,0 L 1,1",
		"M 0 0  L 1 1",
		"M 0 0 L 1e2 1",
		"M 0 0 L .5 1",
		"M 0 0 Q 1 1 2 2",
		"M 0 0 Z",
		" M 0 0",
	];
	for (const path of valid) {
		test(`accepts "${path}"`, () => {
			expect(PLAYBACK_PATH_REGEX.test(path)).toBe(true);
		});
	}
	for (const path of invalid) {
		test(`rejects "${path}"`, () => {
			expect(PLAYBACK_PATH_REGEX.test(path)).toBe(false);
			const data = validPlayback();
			page(data, 1).paths = { "7": path };
			expect(problems(data).length).toBeGreaterThan(0);
		});
	}
});

describe("checker rules", () => {
	test("coverage: a marcher with no moves", () => {
		const data = validPlayback();
		data.moves = data.moves.filter((m) => m.marcherId !== "7");
		data.pages[1] = { ...page(data, 1), paths: {} };
		expectOneProblem(data, 'Marcher "7" has no moves');
	});

	test("coverage: moves must start at tick 0", () => {
		const data = validPlayback();
		move(data, 0).ticks = [480, 3840, 7680];
		expectOneProblem(data, "starts at tick 480, not 0", [
			"moves",
			0,
			"ticks",
			0,
		]);
	});

	test("coverage: moves must reach the end of the show", () => {
		const data = validPlayback();
		move(data, 4).ticks = [11520, 15360, 16800];
		expectOneProblem(data, "the show ends at tick 17280");
	});

	test("coverage: no gaps", () => {
		const data = validPlayback();
		move(data, 3).ticks = [4320, 7680, 11520, 15360, 17280];
		expectOneProblem(data, "has a gap");
	});

	test("coverage: no overlaps", () => {
		const data = validPlayback();
		move(data, 3).ticks = [3360, 7680, 11520, 15360, 17280];
		expectOneProblem(data, "has an overlap");
	});

	test("move order: a marcher's moves are listed in time order", () => {
		const data = validPlayback();
		data.moves = [
			move(data, 1),
			move(data, 3),
			move(data, 2),
			move(data, 0),
			move(data, 4),
		];
		expect(problems(data)).toContainEqual(
			expect.stringContaining("not listed in time order"),
		);
	});

	test("order: ticks never go backward within a move", () => {
		const data = validPlayback();
		move(data, 2).ticks = [7680, 8160, 7920, 11520];
		expect(problems(data)).toEqual([
			expect.stringContaining("ticks must never go backward"),
		]);
	});

	test("order: two points at one tick must be the same position", () => {
		const data = validPlayback();
		move(data, 2).ticks = [7680, 7920, 7920, 11520];
		expectOneProblem(data, "would be a jump", ["moves", 2, "xy", 4]);
	});

	test("continuity: a move starts where the previous one ended", () => {
		const data = validPlayback();
		move(data, 4).xy = [12, 14.5, 12, 14.5, 12, 14.5];
		expectOneProblem(data, "jumps at tick 11520", ["moves", 4, "xy", 0]);
	});

	test("every page start and end is a point", () => {
		const data = validPlayback();
		// Drop the point at set 3 (tick 3840 is set 2's end, 7680 is set 3's end).
		move(data, 3).ticks = [3840, 11520, 15360, 17280];
		move(data, 3).xy = [8, 0, 8, 0, 8, 0, 8, 0];
		expectOneProblem(data, 'Marcher "7" has no point at tick 7680');
	});

	test("drawings must start where the marcher is", () => {
		const data = validPlayback();
		page(data, 3).paths = { "12": "M 4.1 10 C 6 14 10 16 12 14" };
		expectOneProblem(data, "Drawing starts at (4.1, 10)", [
			"pages",
			3,
			"paths",
			"12",
		]);
	});

	test("drawings must end where the marcher is", () => {
		const data = validPlayback();
		page(data, 3).paths = { "12": "M 4 10 C 6 14 10 16 12 13.9" };
		expectOneProblem(data, "Drawing ends at (12, 13.9)");
	});

	test("a drawing filed on the wrong page is caught", () => {
		const data = validPlayback();
		// Marcher 12 is at (4, 10) when both set 3 and set 4 start, so only the
		// end gives it away.
		page(data, 2).paths = page(data, 3).paths;
		page(data, 3).paths = {};
		expectOneProblem(data, 'is at (4, 10) when page "p3" ends', [
			"pages",
			2,
			"paths",
			"12",
		]);
	});

	test("hold after the last set", () => {
		const data = validPlayback();
		move(data, 4).xy = [12, 14, 12, 14, 13, 14];
		expectOneProblem(data, "after the last set", ["moves", 4, "xy", 4]);
	});

	test("pages: IDs are unique", () => {
		const data = validPlayback();
		page(data, 2).id = "p2";
		expectOneProblem(data, 'Page ID "p2" is used twice');
	});

	test("pages: the first page starts at beat 0", () => {
		const data = validPlayback();
		page(data, 0).startBeatIndex = 1;
		expect(problems(data)).toContainEqual(
			expect.stringContaining("must start at beat 0"),
		);
	});

	test("pages: each page starts where the previous one ends", () => {
		const data = validPlayback();
		page(data, 3).startBeatIndex = 17;
		page(data, 3).counts = 7;
		expect(problems(data)).toContainEqual(
			expect.stringContaining("but the previous page ends at beat 16"),
		);
	});

	test("pages: every page after the first has at least 1 count", () => {
		const data = validPlayback();
		data.pages.push({
			id: "p6",
			name: "Set 6",
			startBeatIndex: 32,
			counts: 0,
			paths: {},
		});
		expectOneProblem(data, "must have at least 1 count");
	});

	test("pages: the last page ends at or before the end of the show", () => {
		const data = validPlayback();
		data.pages.push({
			id: "p6",
			name: "Set 6",
			startBeatIndex: 32,
			counts: 8,
			paths: {},
		});
		expect(problems(data)).toContainEqual(
			expect.stringContaining("after the show ends at beat 36"),
		);
	});

	test("measures start within the show", () => {
		const data = validPlayback();
		data.measures?.push({ startBeatIndex: 36, name: "10" });
		expectOneProblem(data, "outside the show", [
			"measures",
			2,
			"startBeatIndex",
		]);
	});

	test("references: performer IDs are unique", () => {
		const data = validPlayback();
		data.performers.push({ id: "7", label: "T7b", section: "Trumpet" });
		expectOneProblem(data, 'Performer ID "7" is used twice');
	});

	test("references: moves refer to performers", () => {
		const data = validPlayback();
		data.moves.push({ marcherId: "99", ticks: [0, 17280], xy: [0, 0, 0, 0] });
		expectOneProblem(data, 'Move for unknown marcher "99"');
	});

	test("references: drawings refer to performers", () => {
		const data = validPlayback();
		page(data, 2).paths = { "99": "M 0 0 L 1 1" };
		expectOneProblem(data, 'Drawing for unknown marcher "99"');
	});

	test("references: appearances refer to real pages and performers", () => {
		const data = validPlayback();
		const appearance = data.performerAppearance?.performers?.[0];
		if (!appearance) throw new Error("fixture has an appearance");
		appearance.marcherId = "99";
		appearance.pageId = "nope";
		expect(problems(data)).toEqual([
			expect.stringContaining('unknown marcher "99"'),
			expect.stringContaining('unknown page "nope"'),
		]);
	});

	test("one kind of problem can't hide the others", () => {
		const data = validPlayback();
		for (let i = 0; i < 300; i++) {
			data.performers.push({ id: `x${i}`, label: `X${i}`, section: "X" });
		}
		page(data, 2).id = "p2"; // reported after 300 coverage problems
		const codes = issuesOf(data).map((i) => i.code);
		expect(codes.filter((c) => c === "coverage.noMoves")).toHaveLength(
			MAX_PLAYBACK_ISSUES_PER_CODE,
		);
		expect(codes).toContain("page.duplicateId");
		expect(problems(data).at(-1)).toBe("…and 290 more problems");
	});

	test("the list stops at the overall cap too", () => {
		const list = new PlaybackIssueList();
		const codes = [
			"coverage.gap",
			"coverage.overlap",
			"coverage.jump",
			"coverage.noMoves",
			"coverage.lateStart",
			"coverage.outOfOrder",
			"coverage.earlyOrLateEnd",
			"point.missingAtPage",
			"hold.firstSet",
			"hold.afterLastSet",
			"move.tickBackward",
			"move.jumpWithinTick",
		] as const;
		for (const code of codes) {
			for (let i = 0; i < 15; i++) list.add({ code, path: [], message: "x" });
		}
		const issues = list.finish();
		expect(issues).toHaveLength(MAX_PLAYBACK_ISSUES + 1);
		expect(issues.at(-1)?.message).toBe("…and 80 more problems");
	});

	test("a hold rule is reported once per marcher", () => {
		const data = validPlayback();
		move(data, 4).ticks = [11520, 15360, 16000, 16640, 17280];
		move(data, 4).xy = [12, 14, 12, 14, 13, 14, 14, 14, 15, 14];
		expect(issuesOf(data)).toEqual([
			expect.objectContaining({ code: "hold.afterLastSet", marcherId: "12" }),
		]);
	});

	test("a bad drawing and mismatched positions have their own codes", () => {
		const badPath = validPlayback();
		page(badPath, 1).paths = { "7": "M 0,0 L 8,0" };
		expect(issuesOf(badPath)).toEqual([
			expect.objectContaining({ code: "path.invalid", marcherId: "7" }),
		]);

		const badXy = validPlayback();
		move(badXy, 1).xy = [0, 0, 8];
		expect(issuesOf(badXy)).toEqual([
			expect.objectContaining({
				code: "move.lengthMismatch",
				marcherId: "7",
				path: ["moves", 1, "xy"],
			}),
		]);
	});
});

describe("checker rules: set 1, measures and codes", () => {
	test("marchers hold on set 1 during any counts it has", () => {
		const data = validPlayback();
		// Set 1 gets 4 counts, and marcher 7 walks during them.
		page(data, 0).counts = 4;
		page(data, 1).startBeatIndex = 4;
		page(data, 1).counts = 4;
		move(data, 1).ticks = [0, 1920, 3840];
		move(data, 1).xy = [5, 5, 0, 0, 8, 0];
		move(data, 0).ticks = [0, 1920, 3840, 7680];
		move(data, 0).xy = [4, 10, 4, 10, 4, 10, 4, 10];
		const issue = expectOneProblem(data, "they must hold on set 1", [
			"moves",
			1,
			"xy",
			2,
		]);
		expect(issue?.code).toBe("hold.firstSet");
		expect(issue?.marcherId).toBe("7");
	});

	test("the first page has no paths", () => {
		const data = validPlayback();
		page(data, 0).paths = { "12": "M 4 10" };
		const issue = expectOneProblem(data, "The first page has no paths", [
			"pages",
			0,
			"paths",
			"12",
		]);
		expect(issue?.code).toBe("page.firstHasPaths");
	});

	test("measures are listed in order, each at least 1 beat long", () => {
		const outOfOrder = validPlayback();
		outOfOrder.measures = [
			{ startBeatIndex: 4, name: "2" },
			{ startBeatIndex: 0, name: "1" },
		];
		expect(issuesOf(outOfOrder)).toEqual([
			expect.objectContaining({
				code: "measure.outOfOrder",
				path: ["measures", 1, "startBeatIndex"],
			}),
		]);

		const sameBeat = validPlayback();
		sameBeat.measures?.push({ startBeatIndex: 4, name: "2b" });
		expect(issuesOf(sameBeat).map((i) => i.code)).toEqual([
			"measure.outOfOrder",
		]);
	});

	test("every problem has a stable code, and the marcher when there is one", () => {
		const data = validPlayback();
		move(data, 3).ticks = [4320, 7680, 11520, 15360, 17280]; // gap for 7
		page(data, 2).id = "p2"; // duplicate page ID
		expect(issuesOf(data)).toEqual([
			expect.objectContaining({ code: "page.duplicateId" }),
			expect.objectContaining({ code: "coverage.gap", marcherId: "7" }),
		]);
		expect(issuesOf(data)[0]).not.toHaveProperty("marcherId");
	});

	test("a missing page point names its marcher", () => {
		const data = validPlayback();
		move(data, 3).ticks = [3840, 11520, 15360, 17280];
		move(data, 3).xy = [8, 0, 8, 0, 8, 0, 8, 0];
		expect(issuesOf(data)).toEqual([
			expect.objectContaining({
				code: "point.missingAtPage",
				marcherId: "7",
			}),
		]);
	});

	test("the Zod schema enforces the rules and carries the codes", () => {
		const data = validPlayback();
		page(data, 0).paths = { "12": "M 4 10" };
		const result = OpenMarchPlaybackSchema.safeParse(data);
		expect(result.success).toBe(false);
		const issue = result.error?.issues[0] as
			| { params?: Record<string, unknown> }
			| undefined;
		expect(issue?.params).toEqual({
			playbackCode: "page.firstHasPaths",
			marcherId: "12",
		});
		expect(OpenMarchPlaybackSchema.safeParse(validPlayback()).success).toBe(
			true,
		);
	});
});

describe("versions", () => {
	test("patch versions are readable, minor versions are breaking while major is 0", () => {
		expect(isSupportedPlaybackVersion("0.1.0")).toBe(true);
		expect(isSupportedPlaybackVersion("0.1.7")).toBe(true);
		expect(isSupportedPlaybackVersion("0.2.0")).toBe(false);
		expect(isSupportedPlaybackVersion("0.0.9")).toBe(false);
		expect(isSupportedPlaybackVersion("1.1.0")).toBe(false);
		expect(isSupportedPlaybackVersion("0.1")).toBe(false);
	});

	test("a file of an unknown breaking version is refused with one problem", () => {
		const data = { ompbVersion: "0.2.0", somethingNew: [] };
		expectOneProblem(data, "Version 0.2.0 can't be read", ["ompbVersion"]);
	});

	test("a newer patch version is read", () => {
		const data = { ...validPlayback(), ompbVersion: "0.1.3" };
		expect(problems(data)).toEqual([]);
	});
});

describe("validating and files", () => {
	test("validate returns the data or throws a short, readable error", () => {
		expect(validateOpenMarchPlaybackData(validPlayback()).moves).toHaveLength(
			5,
		);

		const data = validPlayback();
		for (let i = 0; i < 300; i++) {
			data.performers.push({ id: `x${i}`, label: `X${i}`, section: "X" });
		}
		try {
			validateOpenMarchPlaybackData(data);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(PlaybackValidationError);
			const error = e as PlaybackValidationError;
			expect(error.issues).toHaveLength(MAX_PLAYBACK_ISSUES_PER_CODE + 1);
			expect(error.message.length).toBeLessThan(500);
			expect(error.message).toContain("see .issues");
		}
	});

	test("files are gzipped and read back the same", async () => {
		const original = validateOpenMarchPlaybackData(validPlayback());
		const bytes = await toOpenMarchPlaybackFile(original);
		expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
		expect(await fromOpenMarchPlaybackFile(bytes)).toEqual(original);
		expect(
			await fromOpenMarchPlaybackFile(bytes.buffer as ArrayBuffer),
		).toEqual(original);
	});

	test("plain JSON files are read too", async () => {
		const json = new TextEncoder().encode(JSON.stringify(validPlayback()));
		const data = await fromOpenMarchPlaybackFile(json);
		expect(data.performers).toHaveLength(2);
	});

	test("a file that isn't JSON is a json.invalid problem", async () => {
		const bytes = new TextEncoder().encode("{ nope");
		const error = await fromOpenMarchPlaybackFile(bytes).catch((e) => e);
		expect(error).toBeInstanceOf(PlaybackValidationError);
		expect((error as PlaybackValidationError).issues[0]?.code).toBe(
			"json.invalid",
		);
	});

	test("a damaged or cut-off file is a file.corrupt problem", async () => {
		const bytes = await toOpenMarchPlaybackFile(validPlayback());
		for (const damaged of [
			bytes.slice(0, bytes.length - 12),
			new Uint8Array([0x1f, 0x8b, 1, 2, 3]),
		]) {
			const error = await fromOpenMarchPlaybackFile(damaged).catch((e) => e);
			expect(error).toBeInstanceOf(PlaybackValidationError);
			expect((error as PlaybackValidationError).issues[0]?.code).toBe(
				"file.corrupt",
			);
		}
	});

	test("a __proto__ marcher ID in paths is refused, not skipped", () => {
		const data = JSON.parse(JSON.stringify(validPlayback()));
		data.pages[0].paths = JSON.parse('{"__proto__":"M 0 0"}');
		expect(issuesOf(data)).toEqual([
			expect.objectContaining({
				code: "path.invalid",
				path: ["pages", 0, "paths", "__proto__"],
			}),
		]);
	});

	test("the Zod schema refuses an unknown version with its code", () => {
		const result = OpenMarchPlaybackSchema.safeParse({
			...validPlayback(),
			ompbVersion: "0.2.0",
		});
		const issue = result.error?.issues[0] as
			| { message: string; params?: Record<string, unknown> }
			| undefined;
		expect(issue?.params).toEqual({ playbackCode: "version.unsupported" });
		expect(issue?.message).toContain("Version 0.2.0 can't be read");
	});

	test("an exporter's plain objects can be written directly", async () => {
		const bytes = await toOpenMarchPlaybackFile(validPlayback());
		expect(bytes.length).toBeGreaterThan(0);
	});

	test("an invalid show is never written", async () => {
		const data = validPlayback();
		move(data, 0).ticks = [480, 3840, 7680];
		expect(toOpenMarchPlaybackFile(data)).rejects.toBeInstanceOf(
			PlaybackValidationError,
		);
	});

	test("the public API stays small", () => {
		const playbackExports = Object.keys(publicApi)
			.filter((k) => /playback/i.test(k))
			.sort();
		expect(playbackExports).toEqual([
			"OpenMarchPlaybackSchema",
			"PLAYBACK_SCHEMA_VERSION",
			"PlaybackValidationError",
			"fromOpenMarchPlaybackFile",
			"getOpenMarchPlaybackJsonSchema",
			"getOpenMarchPlaybackJsonSchemaString",
			"isSupportedPlaybackVersion",
			"safeValidateOpenMarchPlaybackData",
			"toOpenMarchPlaybackFile",
			"validateOpenMarchPlaybackData",
		]);
		expect(publicApi).not.toHaveProperty("findRuleIssues");
	});
});

describe("JSON Schema", () => {
	test("describes the shape and allows unknown fields", () => {
		const schema = getOpenMarchPlaybackJsonSchema() as {
			properties: Record<string, unknown>;
			additionalProperties?: unknown;
			required: string[];
		};
		expect(Object.keys(schema.properties)).toEqual(
			expect.arrayContaining(["ompbVersion", "ticksPerBeat", "pages", "moves"]),
		);
		expect(schema.additionalProperties).toBeUndefined();
		expect(schema.required).toContain("moves");
	});

	test("refuses versions this reader can't read", () => {
		const schema = getOpenMarchPlaybackJsonSchema() as unknown as {
			properties: { ompbVersion: { pattern: string } };
		};
		const pattern = new RegExp(schema.properties.ompbVersion.pattern);
		for (const version of ["0.1.0", "0.1.12"]) {
			expect(pattern.test(version)).toBe(true);
			expect(isSupportedPlaybackVersion(version)).toBe(true);
		}
		for (const version of ["0.2.0", "1.1.0", "0.1", "0.1.0-beta", "00.1.0"]) {
			expect(pattern.test(version)).toBe(false);
			expect(isSupportedPlaybackVersion(version)).toBe(false);
		}
	});
});
