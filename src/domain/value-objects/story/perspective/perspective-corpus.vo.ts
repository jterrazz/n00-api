import { z } from 'zod/v4';

export const perspectiveCorpusSchema = z
    .string()
    .min(200, 'Perspective corpus must be at least 200 characters long')
    .max(20000, 'Perspective corpus cannot exceed 20000 characters')
    .describe(
        'A comprehensive and detailed summary of a single perspective on the story. This corpus should act as a raw information dump for a writer, containing all key arguments, evidence, quotes, and contextual details necessary to construct a full article from this viewpoint. The focus is on completeness and accuracy and clarity for reconstructing the information, not on narrative polish.' +
            'It MUST contain ALL the information needed to understand this perspective, including the main points, key details, and any relevant context. It does not need to be written, just a list of all the information. In the most efficient way possible.' +
            'CRITICAL: DO NOT FORGET ANYTHING. WRITE EVERYTHING.',
    );

export class PerspectiveCorpus {
    public readonly value: string;

    constructor(corpus: string) {
        const result = perspectiveCorpusSchema.safeParse(corpus);

        if (!result.success) {
            throw new Error(`Invalid perspective corpus: ${result.error.message}`);
        }

        this.value = result.data;
    }

    public toString(): string {
        return this.value;
    }
}
