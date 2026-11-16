import { findRuleIssues, type PlaybackIssue, PlaybackIssueList } from "./check";
import { OpenMarchPlaybackShapeSchema } from "./schema";
import type { OpenMarchPlaybackData } from "./types";
import {
	isSupportedPlaybackVersion,
	unsupportedVersionMessage,
} from "./version";

export type PlaybackValidationResult =
	| { success: true; data: OpenMarchPlaybackData }
	| { success: false; issues: PlaybackIssue[] };

/** Thrown when playback data breaks the schema or a rule. */
export class PlaybackValidationError extends Error {
	readonly issues: PlaybackIssue[];

	constructor(issues: PlaybackIssue[]) {
		const shown = issues
			.filter((i) => i.code !== "truncated")
			.slice(0, 3)
			.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message);
		const more = issues.length - shown.length;
		super(
			`Invalid OpenMarch playback data: ${shown.join("; ")}${more > 0 ? ` (and more; see .issues)` : ""}`,
		);
		this.name = "PlaybackValidationError";
		this.issues = issues;
	}
}

/**
 * Validate an already-parsed object as `.ompb` playback data: version, shape,
 * then every checker rule. Returns the problems instead of throwing.
 *
 * Unknown fields are allowed but left out of `data`, so a tool that reads and
 * rewrites a file with an older package drops fields it doesn't know.
 */
export function safeValidateOpenMarchPlaybackData(
	data: unknown,
): PlaybackValidationResult {
	// A version this reader can't read gets one problem, not a pile of shape
	// errors from a format it doesn't know.
	const version =
		typeof data === "object" && data !== null
			? (data as { ompbVersion?: unknown }).ompbVersion
			: undefined;
	if (typeof version === "string" && !isSupportedPlaybackVersion(version)) {
		return {
			success: false,
			issues: [
				{
					code: "version.unsupported",
					path: ["ompbVersion"],
					message: unsupportedVersionMessage(version),
				},
			],
		};
	}

	// JSON.parse keeps a "__proto__" key, but Zod's record drops it, so it would
	// skip every check while readers in other languages still see it.
	const protoKeys = protoPathKeys(data);
	if (protoKeys.length > 0) return { success: false, issues: protoKeys };

	const shape = OpenMarchPlaybackShapeSchema.safeParse(data);
	if (!shape.success) {
		const list = new PlaybackIssueList();
		for (const issue of shape.error.issues) {
			list.add(
				shapeIssue(
					data,
					issue.path.filter((p): p is string | number => typeof p !== "symbol"),
					issue.message,
				),
			);
		}
		return { success: false, issues: list.finish() };
	}

	const issues = findRuleIssues(shape.data);
	return issues.length > 0
		? { success: false, issues }
		: { success: true, data: shape.data };
}

/**
 * A shape problem, with its own code where readers and exporters need to tell
 * it apart: a bad drawing, or a move whose positions don't match its ticks.
 */
function shapeIssue(
	data: unknown,
	path: (string | number)[],
	message: string,
): PlaybackIssue {
	const [top, index, field, key] = path;
	if (top === "pages" && field === "paths" && typeof key === "string") {
		return { code: "path.invalid", path, message, marcherId: key };
	}
	if (top === "moves" && field === "xy" && path.length === 3) {
		const marcherId = (data as { moves?: { marcherId?: unknown }[] }).moves?.[
			index as number
		]?.marcherId;
		return typeof marcherId === "string"
			? { code: "move.lengthMismatch", path, message, marcherId }
			: { code: "move.lengthMismatch", path, message };
	}
	return { code: "shape", path, message };
}

function protoPathKeys(data: unknown): PlaybackIssue[] {
	const pages = (data as { pages?: unknown } | null)?.pages;
	if (!Array.isArray(pages)) return [];
	const issues: PlaybackIssue[] = [];
	pages.forEach((page: unknown, i) => {
		const paths = (page as { paths?: unknown } | null)?.paths;
		if (
			typeof paths === "object" &&
			paths !== null &&
			Object.hasOwn(paths, "__proto__")
		) {
			issues.push({
				code: "path.invalid",
				path: ["pages", i, "paths", "__proto__"],
				message: 'A marcher ID can\'t be "__proto__"',
				marcherId: "__proto__",
			});
		}
	});
	return issues;
}

/**
 * Validate an already-parsed object as `.ompb` playback data.
 * @throws {PlaybackValidationError} If it breaks the schema or any rule
 */
export function validateOpenMarchPlaybackData(
	data: unknown,
): OpenMarchPlaybackData {
	const result = safeValidateOpenMarchPlaybackData(data);
	if (!result.success) throw new PlaybackValidationError(result.issues);
	return result.data;
}

// ============================================================================
// FILES (.ompb is always gzip-compressed)
// ============================================================================

async function pipeBytes(
	bytes: Uint8Array,
	transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
	// Untyped like the .om helpers: DOM and Bun disagree on stream chunk types.
	const readable = new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
	const buffer = await new Response(
		readable.pipeThrough(transform),
	).arrayBuffer();
	return new Uint8Array(buffer);
}

/**
 * Bytes to write to an `.ompb` file: the playback data as gzip-compressed JSON.
 * Validates first, so a file that breaks a rule is never written.
 *
 * @throws {PlaybackValidationError} If it breaks the schema or any rule
 */
export async function toOpenMarchPlaybackFile(
	data: OpenMarchPlaybackData,
): Promise<Uint8Array> {
	const valid = validateOpenMarchPlaybackData(data);
	const json = new TextEncoder().encode(JSON.stringify(valid));
	return pipeBytes(json, new CompressionStream("gzip"));
}

/**
 * Read an `.ompb` file. Detects gzip by its magic bytes (1f 8b), so plain JSON
 * also works, then validates the version, shape and every rule.
 *
 * @throws {PlaybackValidationError} If the file is damaged, the JSON is
 * invalid, or the data breaks the schema or any rule
 */
export async function fromOpenMarchPlaybackFile(
	data: ArrayBuffer | Uint8Array,
): Promise<OpenMarchPlaybackData> {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
	let text: string;
	try {
		text = new TextDecoder().decode(
			isGzip ? await pipeBytes(bytes, new DecompressionStream("gzip")) : bytes,
		);
	} catch (e) {
		// Most often a download that was cut off.
		throw new PlaybackValidationError([
			{
				code: "file.corrupt",
				path: [],
				message: `The file is damaged or incomplete and can't be decompressed${e instanceof Error && e.message ? `: ${e.message}` : ""}`,
			},
		]);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		throw new PlaybackValidationError([
			{
				code: "json.invalid",
				path: [],
				message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
			},
		]);
	}
	return validateOpenMarchPlaybackData(parsed);
}
