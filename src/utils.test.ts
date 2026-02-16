import { describe, expect, test } from "bun:test";
import type { OpenMarchShowData, OpenMarchTempoData } from "./types";
import {
	fromOpenMarchSchemaFile,
	fromOpenMarchTempoDataFile,
	toCompressedOpenMarchSchema,
	toCompressedOpenMarchTempoDataSchema,
	toOpenMarchFile,
	toOpenMarchJson,
	toOpenMarchTempoDataFile,
	toOpenMarchTempoDataJson,
} from "./utils";

// Minimal valid schema matching OpenMarchSchema shape (same as schema.test.ts)
const validSchema: OpenMarchShowData = {
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
			widthFeet: 5400,
			heightFeet: 2700,
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

// Minimal valid OpenMarch Tempo schema (timing only)
const validTempoSchema: OpenMarchTempoData = {
	omSchemaVersion: "1.0.0",
	metadata: validSchema.metadata,
	pages: validSchema.pages,
	tempoSections: validSchema.tempoSections,
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

describe("fromOpenMarchSchemaFile", () => {
	test("parses raw JSON (.om) and returns validated schema", async () => {
		const json = toOpenMarchJson(validSchema);
		const buffer = new TextEncoder().encode(json).buffer;
		const result = await fromOpenMarchSchemaFile(buffer);
		expect(result).toEqual(validSchema);
	});

	test("parses gzipped JSON (.omz) and returns validated schema", async () => {
		const compressed = await toCompressedOpenMarchSchema(validSchema);
		const result = await fromOpenMarchSchemaFile(
			compressed.buffer as ArrayBuffer,
		);
		expect(result).toEqual(validSchema);
	});

	test("detects gzip by magic bytes (1f 8b)", async () => {
		const compressed = await toCompressedOpenMarchSchema(validSchema);
		expect(compressed[0]).toBe(0x1f);
		expect(compressed[1]).toBe(0x8b);
		const result = await fromOpenMarchSchemaFile(
			compressed.buffer as ArrayBuffer,
		);
		expect(result).toEqual(validSchema);
	});
});

describe("toOpenMarchFile", () => {
	test("compressed: false returns UTF-8 JSON bytes (`.om`)", async () => {
		const result = await toOpenMarchFile(validSchema, { compressed: false });
		expect(result).toBeInstanceOf(Uint8Array);
		const decoded = new TextDecoder().decode(result);
		expect(decoded).toBe(toOpenMarchJson(validSchema));
	});

	test("compressed: false output equals TextEncoder.encode(toOpenMarchJson(schema))", async () => {
		const result = await toOpenMarchFile(validSchema, { compressed: false });
		const expected = new Uint8Array(
			new TextEncoder().encode(toOpenMarchJson(validSchema)),
		);
		expect(result).toEqual(expected);
	});

	test("compressed: true returns gzipped bytes (`.omz`)", async () => {
		const result = await toOpenMarchFile(validSchema, { compressed: true });
		expect(result).toBeInstanceOf(Uint8Array);
		expect(result[0]).toBe(0x1f);
		expect(result[1]).toBe(0x8b);
	});

	test("compressed: true output is smaller than compressed: false for typical schema", async () => {
		const uncompressed = await toOpenMarchFile(validSchema, {
			compressed: false,
		});
		const compressed = await toOpenMarchFile(validSchema, { compressed: true });
		expect(compressed.length).toBeLessThan(uncompressed.length);
	});

	test("compressed: false round-trips with fromOpenMarchSchemaFile", async () => {
		const bytes = await toOpenMarchFile(validSchema, { compressed: false });
		const parsed = await fromOpenMarchSchemaFile(bytes.buffer as ArrayBuffer);
		expect(parsed).toEqual(validSchema);
	});

	test("compressed: true round-trips with fromOpenMarchSchemaFile", async () => {
		const bytes = await toOpenMarchFile(validSchema, { compressed: true });
		const parsed = await fromOpenMarchSchemaFile(bytes.buffer as ArrayBuffer);
		expect(parsed).toEqual(validSchema);
	});

	test("compressed: true matches toCompressedOpenMarchSchema output", async () => {
		const fromFile = await toOpenMarchFile(validSchema, { compressed: true });
		const fromCompressed = await toCompressedOpenMarchSchema(validSchema);
		expect(fromFile).toEqual(fromCompressed);
	});
});

describe("toOpenMarchTempoDataJson", () => {
	test("returns a JSON string with schema URL and tempo data", () => {
		const json = toOpenMarchTempoDataJson(validTempoSchema);
		expect(typeof json).toBe("string");
		const parsed = JSON.parse(json);
		expect(parsed.schema).toBe("https://openmarch.com/schema/0.1.0");
		expect(parsed.omSchemaVersion).toBe("1.0.0");
		expect(parsed.pages).toEqual(validTempoSchema.pages);
		expect(parsed.tempoSections).toEqual(validTempoSchema.tempoSections);
	});
});

describe("toOpenMarchTempoDataFile", () => {
	test("compressed: false returns UTF-8 JSON bytes (`.omt`)", async () => {
		const result = await toOpenMarchTempoDataFile(validTempoSchema, {
			compressed: false,
		});
		expect(result).toBeInstanceOf(Uint8Array);
		const decoded = new TextDecoder().decode(result);
		expect(decoded).toBe(toOpenMarchTempoDataJson(validTempoSchema));
	});

	test("compressed: false round-trips with fromOpenMarchTempoDataFile", async () => {
		const bytes = await toOpenMarchTempoDataFile(validTempoSchema, {
			compressed: false,
		});
		const parsed = await fromOpenMarchTempoDataFile(
			bytes.buffer as ArrayBuffer,
		);
		expect(parsed).toEqual(validTempoSchema);
	});

	test("compressed: true returns gzipped bytes", async () => {
		const result = await toOpenMarchTempoDataFile(validTempoSchema, {
			compressed: true,
		});
		expect(result).toBeInstanceOf(Uint8Array);
		expect(result[0]).toBe(0x1f);
		expect(result[1]).toBe(0x8b);
	});

	test("compressed: true round-trips with fromOpenMarchTempoDataFile", async () => {
		const bytes = await toOpenMarchTempoDataFile(validTempoSchema, {
			compressed: true,
		});
		const parsed = await fromOpenMarchTempoDataFile(
			bytes.buffer as ArrayBuffer,
		);
		expect(parsed).toEqual(validTempoSchema);
	});
});

describe("fromOpenMarchTempoDataFile", () => {
	test("parses raw JSON (.omt) and returns validated tempo schema", async () => {
		const json = toOpenMarchTempoDataJson(validTempoSchema);
		const buffer = new TextEncoder().encode(json).buffer;
		const result = await fromOpenMarchTempoDataFile(buffer);
		expect(result).toEqual(validTempoSchema);
	});

	test("parses gzipped JSON and returns validated tempo schema", async () => {
		const compressed =
			await toCompressedOpenMarchTempoDataSchema(validTempoSchema);
		const result = await fromOpenMarchTempoDataFile(
			compressed.buffer as ArrayBuffer,
		);
		expect(result).toEqual(validTempoSchema);
	});
});
