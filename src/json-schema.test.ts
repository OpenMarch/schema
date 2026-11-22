import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	getJsonSchema,
	getOpenMarchPlaybackJsonSchema,
	getOpenMarchTempoDataJsonSchema,
} from "./json-schema";

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
