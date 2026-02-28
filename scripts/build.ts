/**
 * Builds ESM and CJS bundles for @openmarch/schema.
 * Run after `tsc` (emits declarations to dist/).
 */
export {};

const entrypoint = "./src/index.ts";
const outdir = "./dist";

const base = {
	entrypoints: [entrypoint],
	outdir,
	target: "node" as const,
};

const esm = await Bun.build({
	...base,
	format: "esm",
});
if (!esm.success) {
	for (const log of esm.logs) console.error(log);
	process.exit(1);
}

const cjs = await Bun.build({
	...base,
	format: "cjs",
	naming: { entry: "[name].cjs" },
});
if (!cjs.success) {
	for (const log of cjs.logs) console.error(log);
	process.exit(1);
}

console.log("Built dist/index.js (ESM) and dist/index.cjs (CJS)");
