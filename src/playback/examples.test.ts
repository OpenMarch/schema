import { describe, expect, test } from "bun:test";
import { fromOpenMarchPlaybackFile } from "../index";
import { formatExampleJson, PLAYBACK_EXAMPLES } from "./examples";
import { safeValidateOpenMarchPlaybackData } from "./validate";

const dir = new URL("../../examples/", import.meta.url).pathname;

describe("example files", () => {
	for (const [name, build] of Object.entries(PLAYBACK_EXAMPLES)) {
		test(`${name} is valid`, () => {
			const result = safeValidateOpenMarchPlaybackData(build());
			expect(result.success ? [] : result.issues).toEqual([]);
		});

		test(`examples/${name}.ompb and .json match the builder (run generate-examples if not)`, async () => {
			const ompb = await Bun.file(`${dir}${name}.ompb`).arrayBuffer();
			expect(await fromOpenMarchPlaybackFile(ompb)).toEqual(build());
			expect(await Bun.file(`${dir}${name}.json`).text()).toBe(
				formatExampleJson(build()),
			);
		});
	}
});
