#!/usr/bin/env bun
/**
 * Writes the example `.ompb` shows to `examples/`: a gzipped `.ompb` file and
 * a readable `.json` copy of each. Run with: bun run generate-examples
 */
import { toOpenMarchPlaybackFile } from "../src/playback";
import { formatExampleJson, PLAYBACK_EXAMPLES } from "../src/playback/examples";

const dir = new URL("../examples/", import.meta.url).pathname;

for (const [name, build] of Object.entries(PLAYBACK_EXAMPLES)) {
	const data = build();
	await Bun.write(`${dir}${name}.ompb`, await toOpenMarchPlaybackFile(data));
	await Bun.write(`${dir}${name}.json`, formatExampleJson(data));
	console.log(`Wrote examples/${name}.ompb and examples/${name}.json`);
}
