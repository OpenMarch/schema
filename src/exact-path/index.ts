// Public API for exact paths in `.om` files: the format, its rules (EP-1 to
// EP-6, and EP-P1 to EP-P3 for placing paths in a show) and how to play them
// (EP-R).
export {
	type ArcCircle,
	arcCircle,
	type CubicMeasure,
	checkExactPath,
	EXACT_MIN_LENGTH,
	type ExactArc,
	type ExactCubic,
	type ExactKey,
	type ExactPath,
	type ExactPathProblem,
	type ExactPathRule,
	type ExactPiece,
	type ExactPlayer,
	type ExactPoints,
	type ExactShape,
	exactPieceCount,
	exactPieces,
	exactPlayer,
	exactPointAt,
	measureCubic,
	TICKS_PER_BEAT,
	type XY,
} from "./exactPath";
export {
	createExactPathReader,
	type ExactPathReader,
	type ExactPathShow,
} from "./reader";
export {
	ExactArcSchema,
	ExactCubicSchema,
	ExactKeySchema,
	type ExactPathEntry,
	ExactPathEntrySchema,
	ExactPathListSchema,
	type ExactPathPlacementRule,
	ExactPathSchema,
	ExactPointsSchema,
	ExactShapeSchema,
} from "./schema";
