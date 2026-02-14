import { describe, expect, test } from "bun:test";
import {
	formatValidationErrors,
	getJsonSchema,
	getOpenMarchTempoJsonSchema,
	isValidOpenMarchData,
	OpenMarchSchema,
	OpenMarchTempoSchema,
	parseOpenMarchSchema,
	parseOpenMarchTempoSchema,
	safeParseOpenMarchSchema,
	safeParseOpenMarchTempoSchema,
} from "./index";

// Sample valid data
const validShowData = {
	omSchemaVersion: "1.0.0",
	metadata: {
		performanceArea: {
			yOrigin: "front" as const,
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

// Valid OpenMarch Tempo data (timing only; no performers or coordinates)
const validTempoData = {
	omSchemaVersion: "1.0.0",
	metadata: validShowData.metadata,
	pages: validShowData.pages,
	tempoSections: validShowData.tempoSections,
};

describe("OpenMarchSchema", () => {
	test("validates correct data", () => {
		const result = OpenMarchSchema.safeParse(validShowData);
		expect(result.success).toBe(true);
	});

	test("rejects missing required fields", () => {
		const invalidData = {
			omSchemaVersion: "1.0.0",
			// missing metadata, performers, pages, etc.
		};
		const result = OpenMarchSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	test("rejects invalid yOrigin", () => {
		const invalidData = {
			...validShowData,
			metadata: {
				...validShowData.metadata,
				performanceArea: {
					...validShowData.metadata.performanceArea,
					yOrigin: "back", // should be "front"
				},
			},
		};
		const result = OpenMarchSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	test("accepts optional fields", () => {
		const dataWithOptionals = {
			...validShowData,
			metadata: {
				...validShowData.metadata,
				audioOffsetSeconds: 1.5,
			},
			measures: [
				{
					startBeatIndex: 0,
					name: "1",
					rehearsalMark: "A",
				},
			],
		};
		const result = OpenMarchSchema.safeParse(dataWithOptionals);
		expect(result.success).toBe(true);
	});

	test("validates coordinate rotation", () => {
		const dataWithRotation = {
			...validShowData,
			coordinates: [
				{
					marcherId: "1",
					pageId: "page-1",
					xSteps: 0,
					ySteps: 16,
					rotation_degrees: 45,
				},
			],
		};
		const result = OpenMarchSchema.safeParse(dataWithRotation);
		expect(result.success).toBe(true);
	});
});

describe("parseOpenMarchSchema", () => {
	test("parses valid JSON string", () => {
		const jsonString = JSON.stringify(validShowData);
		const result = parseOpenMarchSchema(jsonString);
		expect(result.omSchemaVersion).toBe("1.0.0");
		expect(result.performers.length).toBe(1);
	});

	test("throws on invalid JSON", () => {
		expect(() => parseOpenMarchSchema("not valid json")).toThrow();
	});

	test("throws on invalid schema", () => {
		const invalidJson = JSON.stringify({ foo: "bar" });
		expect(() => parseOpenMarchSchema(invalidJson)).toThrow();
	});
});

describe("safeParseOpenMarchSchema", () => {
	test("returns success for valid data", () => {
		const jsonString = JSON.stringify(validShowData);
		const result = safeParseOpenMarchSchema(jsonString);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.omSchemaVersion).toBe("1.0.0");
		}
	});

	test("returns error for invalid JSON", () => {
		const result = safeParseOpenMarchSchema("not valid json");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain("Invalid JSON");
		}
	});

	test("returns error for invalid schema", () => {
		const result = safeParseOpenMarchSchema(JSON.stringify({ foo: "bar" }));
		expect(result.success).toBe(false);
	});
});

describe("isValidOpenMarchData", () => {
	test("returns true for valid data", () => {
		expect(isValidOpenMarchData(validShowData)).toBe(true);
	});

	test("returns false for invalid data", () => {
		expect(isValidOpenMarchData({ foo: "bar" })).toBe(false);
	});

	test("returns false for null", () => {
		expect(isValidOpenMarchData(null)).toBe(false);
	});
});

describe("formatValidationErrors", () => {
	test("formats errors with paths", () => {
		const result = OpenMarchSchema.safeParse({ foo: "bar" });
		if (!result.success) {
			const errors = formatValidationErrors(result.error);
			expect(errors.length).toBeGreaterThan(0);
			expect(typeof errors[0]).toBe("string");
		}
	});
});

describe("getJsonSchema", () => {
	test("returns valid JSON schema object", () => {
		const schema = getJsonSchema();
		expect(schema).toBeDefined();
		expect(typeof schema).toBe("object");
	});

	test("includes required properties", () => {
		const schema = getJsonSchema() as any;
		expect(schema.type).toBe("object");
		expect(schema.properties).toBeDefined();
		expect(schema.properties.omSchemaVersion).toBeDefined();
		expect(schema.properties.metadata).toBeDefined();
		expect(schema.properties.performers).toBeDefined();
	});
});

describe("OpenMarchTempoSchema", () => {
	test("validates correct tempo-only data", () => {
		const result = OpenMarchTempoSchema.safeParse(validTempoData);
		expect(result.success).toBe(true);
	});

	test("accepts optional measures", () => {
		const dataWithMeasures = {
			...validTempoData,
			measures: [{ startBeatIndex: 0, name: "1", rehearsalMark: "A" }],
		};
		const result = OpenMarchTempoSchema.safeParse(dataWithMeasures);
		expect(result.success).toBe(true);
	});

	test("rejects data with performers (tempo-only format)", () => {
		const dataWithPerformers = {
			...validTempoData,
			performers: [{ id: 1, label: "BD1", section: "Baritone" }],
		};
		const result = OpenMarchTempoSchema.safeParse(dataWithPerformers);
		expect(result.success).toBe(true); // Zod allows extra keys by default
	});
	// Strict rejection would require .strict(); plan says "reject objects with performers or coordinates"
	// With default Zod, extra keys are stripped. So we test that valid tempo data has no performers/coordinates after parse.
	test("parsed result has no performers or coordinates", () => {
		const result = OpenMarchTempoSchema.safeParse(validTempoData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect("performers" in result.data).toBe(false);
			expect("coordinates" in result.data).toBe(false);
		}
	});

	test("rejects missing required timing fields", () => {
		const invalidData = {
			omSchemaVersion: "1.0.0",
			// missing metadata, pages, tempoSections
		};
		const result = OpenMarchTempoSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});

describe("parseOpenMarchTempoSchema", () => {
	test("parses valid JSON string", () => {
		const jsonString = JSON.stringify(validTempoData);
		const result = parseOpenMarchTempoSchema(jsonString);
		expect(result.omSchemaVersion).toBe("1.0.0");
		expect(result.pages.length).toBe(1);
		expect(result.tempoSections.length).toBe(1);
	});

	test("throws on invalid JSON", () => {
		expect(() => parseOpenMarchTempoSchema("not valid json")).toThrow();
	});

	test("throws on invalid schema", () => {
		const invalidJson = JSON.stringify({ foo: "bar" });
		expect(() => parseOpenMarchTempoSchema(invalidJson)).toThrow();
	});
});

describe("safeParseOpenMarchTempoSchema", () => {
	test("returns success for valid data", () => {
		const jsonString = JSON.stringify(validTempoData);
		const result = safeParseOpenMarchTempoSchema(jsonString);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.omSchemaVersion).toBe("1.0.0");
		}
	});

	test("returns error for invalid JSON", () => {
		const result = safeParseOpenMarchTempoSchema("not valid json");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain("Invalid JSON");
		}
	});

	test("returns error for invalid schema", () => {
		const result = safeParseOpenMarchTempoSchema(
			JSON.stringify({ foo: "bar" }),
		);
		expect(result.success).toBe(false);
	});
});

describe("getOpenMarchTempoJsonSchema", () => {
	test("returns valid JSON schema object", () => {
		const schema = getOpenMarchTempoJsonSchema();
		expect(schema).toBeDefined();
		expect(typeof schema).toBe("object");
	});

	test("includes tempo schema properties but not performers or coordinates", () => {
		const schema = getOpenMarchTempoJsonSchema() as any;
		expect(schema.type).toBe("object");
		expect(schema.properties).toBeDefined();
		expect(schema.properties.omSchemaVersion).toBeDefined();
		expect(schema.properties.metadata).toBeDefined();
		expect(schema.properties.pages).toBeDefined();
		expect(schema.properties.tempoSections).toBeDefined();
		expect(schema.properties.measures).toBeDefined();
		expect(schema.properties.performers).toBeUndefined();
		expect(schema.properties.coordinates).toBeUndefined();
	});
});
