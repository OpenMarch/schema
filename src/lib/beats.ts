import type { TempoSection } from "../types";

export type Beat = {
	index: number;
	timestampSeconds: number;
	tempoBpm: number;
};

/**
 * Converts tempo sections into a list of beats.
 *
 * @param tempoSections - The tempo sections to convert.
 * @returns Beats sorted by index
 */
export const tempoSectionsToBeats = (tempoSections: TempoSection[]): Beat[] => {
	const beats: Beat[] = [];
	let currentTimestampSeconds = 0;
	for (const tempoSection of tempoSections) {
		for (let i = 0; i < tempoSection.numberOfBeats; i++) {
			const beat: Beat = {
				index: beats.length,
				timestampSeconds: currentTimestampSeconds,
				tempoBpm: tempoSection.tempo,
			};
			beats.push(beat);
			currentTimestampSeconds += 60 / tempoSection.tempo;
		}
	}
	return beats;
};
