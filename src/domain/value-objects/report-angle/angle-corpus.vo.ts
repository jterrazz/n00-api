import { z } from 'zod/v4';

export const angleNarrativeSchema = z
    .string()
    .min(200, 'Angle narrative must be at least 200 characters long')
    .max(20000, 'Angle narrative cannot exceed 20000 characters')
    .describe(
        'A comprehensive and detailed narrative presenting a specific perspective on the story. This narrative should contain all key arguments, evidence, quotes, and contextual details necessary to understand this viewpoint completely. The focus is on completeness and accuracy, capturing every significant detail from this angle.' +
            'It MUST contain ALL the information needed to understand this perspective, including the main points, supporting evidence, and any relevant context. Present it as a thorough account of this viewpoint.' +
            'CRITICAL: DO NOT FORGET ANYTHING. CAPTURE EVERYTHING FROM THIS PERSPECTIVE.',
    );

export type AngleNarrativeValue = z.infer<typeof angleNarrativeSchema>;

export class AngleNarrative {
    public readonly value: AngleNarrativeValue;

    constructor(value: string) {
        const result = angleNarrativeSchema.safeParse(value);

        if (!result.success) {
            throw new Error(`Invalid angle narrative: ${result.error.message}`);
        }

        this.value = result.data;
    }

    public toString(): string {
        return this.value;
    }
}
