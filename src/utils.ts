import { OpenMarchSchema as OpenMarchSchemaZod } from "./schema";
import type { OpenMarchSchema } from "./types";

/** Gzip magic bytes (1f 8b) at the start of a file indicate gzip compression. */
const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b]);

function isGzip(data: ArrayBuffer): boolean {
	if (data.byteLength < 2) return false;
	const bytes = new Uint8Array(data);
	return bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/**
 * Data for the `.om` file format (OpenMarch)
 *
 * Converts an OpenMarch schema to a JSON string.
 *
 * @param schema - The OpenMarch schema to convert
 * @returns The JSON string
 */
export const toOpenMarchJson = (schema: OpenMarchSchema) => {
	return JSON.stringify({
		schema: "https://openmarch.com/schema/0.1.0",
		...schema,
	});
};

/**
 * Data for the `.omz` file format (OpenMarch Zipped)
 *
 * Compresses an OpenMarch schema as gzip using the Web CompressionStream API.
 * Returns the compressed bytes as a Uint8Array.
 */
export const toCompressedOpenMarchSchema = async (
	schema: OpenMarchSchema,
): Promise<Uint8Array> => {
	const json = toOpenMarchJson(schema);
	const readable = new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(json));
			controller.close();
		},
	});
	const compressed = readable.pipeThrough(new CompressionStream("gzip"));
	const arrayBuffer = await new Response(compressed).arrayBuffer();
	return new Uint8Array(arrayBuffer);
};

/**
 * Returns bytes to write to an OpenMarch file (`.om` or `.omz`).
 * Use `compressed: false` for raw JSON `.om`, `compressed: true` for gzipped `.omz`.
 *
 * @param schema - The OpenMarch schema to serialize
 * @param options.compressed - If true, return gzipped bytes `.omz`; if false, return UTF-8 JSON `.om`
 * @returns Bytes to write (Uint8Array)
 */
export const toOpenMarchFile = async (
	schema: OpenMarchSchema,
	options: { compressed: boolean },
): Promise<Uint8Array> => {
	if (options.compressed) {
		return toCompressedOpenMarchSchema(schema);
	}
	const json = toOpenMarchJson(schema);
	return new Uint8Array(new TextEncoder().encode(json));
};

/**
 * Parses an OpenMarch file from bytes, supporting both `.om` (raw JSON) and `.omz` (gzipped) formats.
 * Detects format via gzip magic bytes (1f 8b); if present, decompresses then parses JSON.
 * Validates the result against the OpenMarch schema.
 *
 * @param data - File contents as ArrayBuffer (raw JSON or gzipped)
 * @returns Parsed and validated OpenMarchSchema
 * @throws {SyntaxError} If JSON is invalid
 * @throws {z.ZodError} If the data doesn't match the schema
 */
export const fromOpenMarchSchemaFile = async (
	data: ArrayBuffer,
): Promise<OpenMarchSchema> => {
	let json: string;
	if (isGzip(data)) {
		const readable = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(data));
				controller.close();
			},
		});
		const decompressed = readable.pipeThrough(new DecompressionStream("gzip"));
		const decompressedBuffer = await new Response(decompressed).arrayBuffer();
		json = new TextDecoder().decode(decompressedBuffer);
	} else {
		json = new TextDecoder().decode(data);
	}
	const parsed = JSON.parse(json) as unknown;
	return OpenMarchSchemaZod.parse(parsed);
};
