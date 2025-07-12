import { z } from 'zod/v4';

export const stanceSchema = z.enum([
    'SUPPORTIVE',
    'CRITICAL',
    'NEUTRAL',
    'MIXED',
    'CONCERNED',
    'OPTIMISTIC',
    'SKEPTICAL',
]);

export type StanceValue = z.infer<typeof stanceSchema>;

/**
 * @description Domain value object representing a stance toward a report.
 */
export class Stance {
    public readonly value: StanceValue;

    constructor(value: string) {
        const res = stanceSchema.safeParse(value.toUpperCase() as unknown as StanceValue);
        if (!res.success) throw new Error(`Invalid stance: ${res.error.message}`);
        this.value = res.data;
    }

    public toString(): string {
        return this.value;
    }

    public valueOf(): string {
        return this.value;
    }
}
