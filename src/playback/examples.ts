/**
 * Example `.ompb` shows, built in code so they always pass the current
 * checker. `bun run generate-examples` writes them to `examples/` for readers
 * in other languages (such as the mobile app) to test against. Not part of
 * the public API.
 */
import type { OpenMarchPlaybackData, PlaybackMetadata } from "./types";
import { PLAYBACK_SCHEMA_VERSION } from "./version";

const T = 480;

const metadata = (title: string): PlaybackMetadata => ({
	createdAtUtc: "2026-11-16T12:00:00Z",
	info: { title },
	performanceArea: {
		yOrigin: "front",
		inchesPerStep: 22.5,
		xCheckpoints: [
			{
				name: "50 yard line",
				terseName: "50",
				useAsReference: true,
				visible: true,
				stepsFromCenter: 0,
			},
		],
		yCheckpoints: [
			{
				name: "Front sideline",
				terseName: "FSL",
				useAsReference: true,
				visible: true,
				stepsFromYOrigin: 0,
			},
		],
		widthFeet: 360,
		heightFeet: 160,
		useHashes: true,
	},
});

/** A number as a path string wants it: plain decimal, at most 2 places, no "-0". */
const num = (n: number): string => {
	const s = String(Math.round(n * 100) / 100);
	return s === "-0" ? "0" : s;
};

const round2 = (n: number): number => {
	const r = Math.round(n * 100) / 100;
	return Object.is(r, -0) ? 0 : r;
};

/**
 * The example from the format's issue, filled out to a whole show.
 *
 * 36 beats at 480 ticks per beat (show ends at tick 17280). Set 5 ends at
 * beat 32, so everyone holds for the last 4 beats.
 * - Marcher "7" walks a straight line into set 2, then holds.
 * - Marcher "12" holds, curves into set 4, then holds.
 */
export const basicExample = (): OpenMarchPlaybackData => ({
	ompbVersion: PLAYBACK_SCHEMA_VERSION,
	ticksPerBeat: 480,
	metadata: {
		createdAtUtc: "2026-11-16T12:00:00Z",
		performanceArea: {
			yOrigin: "front",
			inchesPerStep: 22.5,
			xCheckpoints: [
				{
					name: "50 yard line",
					terseName: "50",
					useAsReference: true,
					visible: true,
					stepsFromCenter: 0,
				},
			],
			yCheckpoints: [
				{
					name: "Front sideline",
					terseName: "FSL",
					useAsReference: true,
					visible: true,
					stepsFromYOrigin: 0,
				},
			],
			widthFeet: 360,
			heightFeet: 160,
			useHashes: true,
		},
	},
	performers: [
		{ id: "12", label: "B12", section: "Baritone" },
		{ id: "7", label: "T7", section: "Trumpet" },
	],
	performerAppearance: {
		performers: [
			{
				marcherId: "12",
				pageId: "p4",
				fillRgba: "rgba(255,0,0,1)",
				strokeRgba: "rgba(0,0,0,1)",
				strokeWidth: 1,
				visible: true,
				textVisible: true,
				shape: "circle",
			},
		],
	},
	tempoSections: [
		{ tempo: 120, numberOfBeats: 32 },
		{ tempo: 90, numberOfBeats: 4 },
	],
	measures: [
		{ startBeatIndex: 0, name: "1" },
		{ startBeatIndex: 4, name: "2", rehearsalMark: "A" },
	],
	pages: [
		{ id: "p1", name: "Set 1", startBeatIndex: 0, counts: 0, paths: {} },
		{
			id: "p2",
			name: "Set 2",
			startBeatIndex: 0,
			counts: 8,
			paths: { "7": "M 0 0 L 8 0" },
		},
		{ id: "p3", name: "Set 3", startBeatIndex: 8, counts: 8, paths: {} },
		{
			id: "p4",
			name: "Set 4",
			startBeatIndex: 16,
			counts: 8,
			paths: { "12": "M 4 10 C 6 14 10 16 12 14" },
		},
		{ id: "p5", name: "Set 5", startBeatIndex: 24, counts: 8, paths: {} },
	],
	moves: [
		// 0: marcher 12 holds through sets 1 to 3
		{ marcherId: "12", ticks: [0, 3840, 7680], xy: [4, 10, 4, 10, 4, 10] },
		// 1: marcher 7 walks into set 2
		{
			marcherId: "7",
			ticksPerStep: 480,
			ticks: [0, 3840],
			xy: [0, 0, 8, 0],
		},
		// 2: marcher 12 curves into set 4
		{
			marcherId: "12",
			ticksPerStep: 480,
			ticks: [7680, 7920, 8160, 11520],
			xy: [4, 10, 4.6, 10.9, 5.4, 11.7, 12, 14],
		},
		// 3: marcher 7 holds to the end
		{
			marcherId: "7",
			ticks: [3840, 7680, 11520, 15360, 17280],
			xy: [8, 0, 8, 0, 8, 0, 8, 0, 8, 0],
		},
		// 4: marcher 12 holds to the end
		{
			marcherId: "12",
			ticks: [11520, 15360, 17280],
			xy: [12, 14, 12, 14, 12, 14],
		},
	],
});

/**
 * Set 1 with counts, step-rate changes and a subset page. 28 beats at 160 bpm.
 *
 * - Set 1 has 4 counts before set 2's walk begins; everyone holds on set 1.
 * - Marcher "1" walks into set 2 in two moves: 4 counts at one step per count,
 *   then 4 counts of double time (240 ticks per step). The move splits only
 *   because the step rate changes; the drawing covers the whole walk.
 * - Subset page "Set 2A": marcher "1" walks in triplets (160 ticks per step).
 * - Marcher "2" holds for the whole show.
 * - The music runs 4 beats past the last set.
 */
export const setOneCountsExample = (): OpenMarchPlaybackData => ({
	ompbVersion: PLAYBACK_SCHEMA_VERSION,
	ticksPerBeat: T,
	metadata: metadata("Set 1 counts and step rates"),
	performers: [
		{ id: "1", label: "T1", section: "Trumpet" },
		{ id: "2", label: "S1", section: "Snare" },
	],
	performerAppearance: {
		defaultAppearance: {
			fillRgba: "rgba(200,200,200,1)",
			strokeRgba: "rgba(0,0,0,1)",
			strokeWidth: 1,
			visible: true,
			textVisible: true,
			shape: "circle",
		},
		sections: [
			{
				section: "Snare",
				fillRgba: "rgba(0,120,255,1)",
				strokeRgba: "rgba(0,0,0,1)",
				strokeWidth: 1,
				visible: true,
				textVisible: true,
				shape: "square",
			},
		],
	},
	tempoSections: [{ tempo: 160, numberOfBeats: 28 }],
	measures: [
		{ startBeatIndex: 0, name: "1", rehearsalMark: "Intro" },
		{ startBeatIndex: 4, name: "2" },
		{ startBeatIndex: 8, name: "3" },
		{ startBeatIndex: 12, name: "4", rehearsalMark: "A" },
		{ startBeatIndex: 16, name: "5" },
		{ startBeatIndex: 18, name: "6" },
		{ startBeatIndex: 22, name: "7" },
		{ startBeatIndex: 26, name: "8" },
	],
	pages: [
		{ id: "s1", name: "Set 1", startBeatIndex: 0, counts: 4, paths: {} },
		{
			id: "s2",
			name: "Set 2",
			startBeatIndex: 4,
			counts: 8,
			paths: { "1": "M 0 0 L 8 0" },
		},
		{
			id: "s2a",
			name: "Set 2A",
			startBeatIndex: 12,
			counts: 6,
			isSubset: true,
			paths: { "1": "M 8 0 L 8 6" },
		},
		{
			id: "s3",
			name: "Set 3",
			startBeatIndex: 18,
			counts: 6,
			paths: { "1": "M 8 6 L 0 0" },
		},
	],
	moves: [
		{ marcherId: "1", ticks: [0, 1920], xy: [0, 0, 0, 0] },
		{
			marcherId: "1",
			ticksPerStep: 480,
			ticks: [1920, 3840],
			xy: [0, 0, 4, 0],
		},
		{
			marcherId: "1",
			ticksPerStep: 240,
			ticks: [3840, 5760],
			xy: [4, 0, 8, 0],
		},
		{
			marcherId: "1",
			ticksPerStep: 160,
			ticks: [5760, 8640],
			xy: [8, 0, 8, 6],
		},
		{
			marcherId: "1",
			ticksPerStep: 480,
			ticks: [8640, 11520],
			xy: [8, 6, 0, 0],
		},
		{ marcherId: "1", ticks: [11520, 13440], xy: [0, 0, 0, 0] },
		{
			marcherId: "2",
			ticks: [0, 1920, 5760, 8640, 11520, 13440],
			xy: [-4, 2, -4, 2, -4, 2, -4, 2, -4, 2, -4, 2],
		},
	],
});

type Plan = "slide" | "curve" | "hold";

/**
 * A larger show for size and rendering checks: 24 marchers in a block, 10
 * walking pages of 16 counts, two tempos, and 4 beats after the last set.
 *
 * Curves are half circles of radius 4 steps, written as 48 straight sections
 * each (within 1/100 of a step of the true curve) and drawn as two cubic
 * Bézier curves. Slides and curves next to each other with no stop are one move,
 * with a point at the page boundary between them.
 */
export const largeShowExample = (): OpenMarchPlaybackData => {
	const plan: Plan[] = [
		"slide",
		"curve",
		"hold",
		"curve",
		"slide",
		"hold",
		"slide",
		"curve",
		"curve",
		"hold",
	];
	const COUNTS = 16;
	const SEGMENTS = 48;
	const R = 4;
	const K = 0.5523; // cubic Bézier constant for a quarter circle
	const totalBeats = plan.length * COUNTS + 4;
	const showEnd = totalBeats * T;

	const pages: OpenMarchPlaybackData["pages"] = [
		{ id: "p1", name: "Set 1", startBeatIndex: 0, counts: 0, paths: {} },
	];
	plan.forEach((_, i) => {
		pages.push({
			id: `p${i + 2}`,
			name: `Set ${i + 2}`,
			startBeatIndex: i * COUNTS,
			counts: COUNTS,
			paths: {},
		});
	});

	const performers: OpenMarchPlaybackData["performers"] = [];
	const moves: OpenMarchPlaybackData["moves"] = [];

	for (let row = 0; row < 4; row++) {
		for (let col = 0; col < 6; col++) {
			const id = String(row * 6 + col + 1);
			performers.push({
				id,
				label: `B${id}`,
				section: row < 2 ? "Brass" : "Woodwind",
			});

			let x = -5 + col * 2;
			let y = 10 + row * 2;
			let current: { ticks: number[]; xy: number[]; moving: boolean } = {
				ticks: [0],
				xy: [x, y],
				moving: false,
			};
			const push = (tick: number) => {
				current.ticks.push(tick);
				current.xy.push(round2(x), round2(y));
			};
			const startNew = (tick: number, moving: boolean) => {
				moves.push({
					marcherId: id,
					...(current.moving ? { ticksPerStep: T } : {}),
					ticks: current.ticks,
					xy: current.xy,
				});
				current = { ticks: [tick], xy: [round2(x), round2(y)], moving };
			};

			plan.forEach((step, i) => {
				const start = i * COUNTS * T;
				const end = (i + 1) * COUNTS * T;
				const page = pages[i + 1] as (typeof pages)[number];
				const moving = step !== "hold";
				if (moving !== current.moving) {
					// Motion starts or stops at this page start.
					if (current.ticks.length === 1) push(start);
					startNew(start, moving);
				}
				if (step === "hold") {
					push(end);
				} else if (step === "slide") {
					page.paths[id] = `M ${num(x)} ${num(y)} L ${num(x)} ${num(y + 4)}`;
					y += 4;
					push(end);
				} else {
					// Half circle from (x, y) to (x + 8, y), bulging toward +y.
					const cx = x + R;
					const cy = y;
					page.paths[id] =
						`M ${num(x)} ${num(y)}` +
						` C ${num(cx - R)} ${num(cy + K * R)} ${num(cx - K * R)} ${num(cy + R)} ${num(cx)} ${num(cy + R)}` +
						` C ${num(cx + K * R)} ${num(cy + R)} ${num(cx + R)} ${num(cy + K * R)} ${num(cx + R)} ${num(cy)}`;
					for (let s = 1; s <= SEGMENTS; s++) {
						const angle = Math.PI - (Math.PI * s) / SEGMENTS;
						x = cx + R * Math.cos(angle);
						y = cy + R * Math.sin(angle);
						if (s === SEGMENTS) {
							x = cx + R;
							y = cy;
						}
						push(start + Math.round(((end - start) * s) / SEGMENTS));
					}
				}
			});
			// Hold after the last set to the end of the show.
			if (current.moving) startNew(plan.length * COUNTS * T, false);
			push(showEnd);
			moves.push({ marcherId: id, ticks: current.ticks, xy: current.xy });
		}
	}

	return {
		ompbVersion: PLAYBACK_SCHEMA_VERSION,
		ticksPerBeat: T,
		metadata: metadata("Large show"),
		performers,
		tempoSections: [
			{ tempo: 120, numberOfBeats: 80 },
			{ tempo: 144, numberOfBeats: totalBeats - 80 },
		],
		measures: Array.from({ length: totalBeats / 4 }, (_, i) => ({
			startBeatIndex: i * 4,
			name: String(i + 1),
			...(i % 4 === 0
				? { rehearsalMark: String.fromCharCode(65 + i / 4) }
				: {}),
		})),
		pages,
		moves,
	};
};

/** Every example, by file name (without `.ompb`). */
export const PLAYBACK_EXAMPLES: Record<string, () => OpenMarchPlaybackData> = {
	basic: basicExample,
	"set-one-counts": setOneCountsExample,
	"large-show": largeShowExample,
};

/**
 * Readable JSON for an example: indented objects, but each list of numbers on
 * one line, so `ticks` and `xy` line up instead of running one number per line.
 */
export const formatExampleJson = (data: OpenMarchPlaybackData): string =>
	`${JSON.stringify(data, null, "\t").replace(
		/\[\s*(-?[\d.]+(?:,\s*-?[\d.]+)*)\s*\]/g,
		(_, numbers: string) => `[${numbers.split(/,\s*/).join(", ")}]`,
	)}\n`;
