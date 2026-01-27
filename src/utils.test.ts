import { describe, expect, test } from "bun:test";
import type { OpenMarchSchema } from "./types";
import { toCompressedOpenMarchSchema, toOpenMarchJson } from "./utils";

// Minimal valid schema matching OpenMarchSchema shape (same as schema.test.ts)
const validSchema: OpenMarchSchema = {
	omSchemaVersion: "1.0.0",
	metadata: {
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
			widthInches: 5400,
			heightInches: 2700,
			useHashes: true,
		},
		createdAtUtc: "2024-01-15T10:30:00Z",
		info: {
			title: "Test Show",
			school: "Test High School",
		},
	},
	performers: [
		{
			id: 1,
			label: "BD1",
			section: "Baritone",
			name: "John",
		},
	],
	pages: [
		{
			id: "page-1",
			duration: 8,
			startBeatIndex: 0,
			name: "Opening",
		},
	],
	tempoSections: [
		{
			tempo: 120,
			numberOfBeats: 32,
		},
	],
	coordinates: [
		{
			marcherId: "1",
			pageId: "page-1",
			xSteps: 0,
			ySteps: 16,
		},
	],
};

async function decompressGzip(bytes: Uint8Array): Promise<string> {
	const readable = new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
	const decompressed = readable.pipeThrough(new DecompressionStream("gzip"));
	const arrayBuffer = await new Response(decompressed).arrayBuffer();
	return new TextDecoder().decode(arrayBuffer);
}

describe("toCompressedOpenMarchSchema", () => {
	test("returns a Uint8Array", async () => {
		const result = await toCompressedOpenMarchSchema(validSchema);
		expect(result).toBeInstanceOf(Uint8Array);
		expect(result.length).toBeGreaterThan(0);
	});

	test("output starts with gzip magic bytes (1f 8b)", async () => {
		const result = await toCompressedOpenMarchSchema(validSchema);
		expect(result[0]).toBe(0x1f);
		expect(result[1]).toBe(0x8b);
	});

	test("round-trip: decompress yields original JSON", async () => {
		const compressed = await toCompressedOpenMarchSchema(validSchema);
		const decompressed = await decompressGzip(compressed);
		const expected = toOpenMarchJson(validSchema);
		expect(decompressed).toBe(expected);
	});

	test("compressed output is smaller than uncompressed JSON for typical payload", async () => {
		const compressed = await toCompressedOpenMarchSchema(validSchema);
		const uncompressed = toOpenMarchJson(validSchema);
		const uncompressedBytes = new TextEncoder().encode(uncompressed);
		expect(compressed.length).toBeLessThan(uncompressedBytes.length);
	});
});
