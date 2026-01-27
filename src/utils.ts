import type { OpenMarchSchema } from "./types";

export const toOpenMarchJson = (schema: OpenMarchSchema) => {
	return JSON.stringify({
		schema: "https://openmarch.com/schema/1.0.0",
		...schema,
	});
};

/**
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
