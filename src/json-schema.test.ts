import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import {
	getJsonSchema,
	getOpenMarchPlaybackJsonSchema,
	getOpenMarchTempoDataJsonSchema,
} from "./json-schema";
import { toOpenMarchJson, toOpenMarchTempoDataJson } from "./lib/utils";
import { OpenMarchSchema } from "./schema";

const committed = (name: string) =>
	JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));

describe("committed JSON Schemas", () => {
	test("match the Zod schemas (run `bun run generate-schema` after a change)", () => {
		expect(committed("schema.json")).toEqual(
			JSON.parse(JSON.stringify(getJsonSchema())),
		);
		expect(committed("schema-tempo.json")).toEqual(
			JSON.parse(JSON.stringify(getOpenMarchTempoDataJsonSchema())),
		);
		expect(committed("schema-playback.json")).toEqual(
			JSON.parse(JSON.stringify(getOpenMarchPlaybackJsonSchema())),
		);
	});

	test("carry the exact-path limits a JSON Schema can express", () => {
		const entry = committed("schema.json").properties.exactPaths.items;
		const path = entry.properties.path;
		expect(entry.properties.startTick).toMatchObject({
			type: "integer",
			minimum: 0,
		});
		expect(path.properties.v).toMatchObject({ const: 1 });
		expect(path.properties.shapes.minItems).toBe(1);
		expect(path.properties.keys.minItems).toBe(2);
		expect(path.properties.from).toMatchObject({ minItems: 2, maxItems: 2 });
		const arc = path.properties.shapes.items.oneOf.find(
			(s: { properties: { kind: { const: string } } }) =>
				s.properties.kind.const === "arc",
		);
		expect(arc.properties.bend).toMatchObject({
			minimum: -0.5,
			maximum: 0.5,
			not: { const: 0 },
		});
		expect(arc.properties.bend.description).toContain("negate bend");
	});
});

describe("validating files with the committed JSON Schemas", () => {
	const ajv = new Ajv2020({ allErrors: true });
	const show = ajv.compile(committed("schema.json"));
	const tempo = ajv.compile(committed("schema-tempo.json"));
	const example = JSON.parse(
		readFileSync(
			new URL("../examples/exact-paths.om", import.meta.url),
			"utf8",
		),
	);
	const { exactPaths: _, ...withoutPaths } = example;
	const tempoOf = (s: typeof example) => ({
		omSchemaVersion: s.omSchemaVersion,
		metadata: { createdAtUtc: s.metadata.createdAtUtc },
		pages: s.pages,
		tempoSections: s.tempoSections,
	});
	const ok = (validate: typeof show, data: unknown) => {
		const valid = validate(data);
		if (!valid) throw new Error(JSON.stringify(validate.errors, null, 1));
		return valid;
	};

	test("a show with exact paths, and one without, are valid", () => {
		expect(ok(show, example)).toBe(true);
		expect(ok(show, withoutPaths)).toBe(true);
	});

	test("a file as this package writes it (with its `schema` key) is valid", () => {
		const written = JSON.parse(toOpenMarchJson(OpenMarchSchema.parse(example)));
		expect(written.schema).toBeDefined();
		expect(ok(show, written)).toBe(true);
	});

	test("unknown top-level fields from a newer version are allowed", () => {
		expect(ok(show, { ...example, someFutureField: [1, 2, 3] })).toBe(true);
	});

	test("unknown fields inside known objects are still refused", () => {
		const coordinates = [
			{ ...example.coordinates[0], typo: true },
			...example.coordinates.slice(1),
		];
		expect(show({ ...example, coordinates })).toBe(false);
	});

	test("a tempo file with an old performanceArea, and one without, are valid", () => {
		const t = tempoOf(example);
		expect(ok(tempo, t)).toBe(true);
		const old = {
			...t,
			metadata: {
				...t.metadata,
				performanceArea: example.metadata.performanceArea,
			},
		};
		expect(ok(tempo, old)).toBe(true);
		expect(ok(tempo, JSON.parse(toOpenMarchTempoDataJson(t)))).toBe(true);
		expect(ok(tempo, { ...t, someFutureField: true })).toBe(true);
	});
});
