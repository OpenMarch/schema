/**
 * Current playback (`.ompb`) format version. Separate from the `.om` version.
 *
 * - A reader ignores fields it doesn't know.
 * - Adding an optional field is not breaking: it bumps the minor version, or
 *   the patch version while the major version is 0.
 * - A breaking change (one that would make an old reader show wrong positions
 *   or timing) bumps the major version, or the minor version while the major
 *   version is 0. A reader refuses a breaking version it doesn't know.
 */
export const PLAYBACK_SCHEMA_VERSION = "0.1.0" as const;

/** Ticks per beat the OpenMarch exporter writes. Readers must use the file's value. */
export const DEFAULT_TICKS_PER_BEAT = 480 as const;

/** The message for a file whose version this reader can't read. */
export function unsupportedVersionMessage(version: string): string {
	return `Version ${version} can't be read by this reader (built for ${PLAYBACK_SCHEMA_VERSION})`;
}

const [MAJOR, MINOR] = PLAYBACK_SCHEMA_VERSION.split(".");

/**
 * Versions this reader can read: same major version, and same minor version
 * while major is 0. Derived from {@link PLAYBACK_SCHEMA_VERSION}, and also
 * written into the JSON Schema so readers in other languages get the same gate.
 */
export const SUPPORTED_PLAYBACK_VERSION_PATTERN =
	MAJOR === "0" ? `^0\\.${MINOR}\\.\\d+$` : `^${MAJOR}\\.\\d+\\.\\d+$`;

const SUPPORTED = new RegExp(SUPPORTED_PLAYBACK_VERSION_PATTERN);

/** True if a reader built for {@link PLAYBACK_SCHEMA_VERSION} can read a file of `version`. */
export function isSupportedPlaybackVersion(version: string): boolean {
	return SUPPORTED.test(version);
}
