// Public API for the .ompb playback format. Kept small on purpose: everything
// here is hard to change once released.
export type { PlaybackIssue, PlaybackIssueCode } from "./check";
export { OpenMarchPlaybackSchema } from "./schema";
export type {
	OpenMarchPlaybackData,
	PlaybackAppearance,
	PlaybackMeasure,
	PlaybackMetadata,
	PlaybackMove,
	PlaybackPage,
	PlaybackPerformer,
	PlaybackTempoSection,
} from "./types";
export {
	fromOpenMarchPlaybackFile,
	PlaybackValidationError,
	type PlaybackValidationResult,
	safeValidateOpenMarchPlaybackData,
	toOpenMarchPlaybackFile,
	validateOpenMarchPlaybackData,
} from "./validate";
export {
	DEFAULT_TICKS_PER_BEAT,
	isSupportedPlaybackVersion,
	PLAYBACK_SCHEMA_VERSION,
} from "./version";
