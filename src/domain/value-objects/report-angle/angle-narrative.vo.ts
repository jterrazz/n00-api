import { z } from 'zod/v4';

export const angleNarrativeSchema = z.string().min(10);

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
