import { z } from 'zod/v4';

/**
 * Zod schema for the Classification. It validates that the classification
 * is one of the allowed string literals.
 */
export const classificationSchema = z.enum(['GENERAL', 'NICHE', 'OFF_TOPIC']);

export type ClassificationType = z.infer<typeof classificationSchema>;

/**
 * @description
 * Represents the classification of a report, determining its
 * potential audience appeal and placement priority.
 *
 * @example
 * const classification = new Classification('GENERAL');
 */
export class Classification {
    public readonly value: ClassificationType;

    constructor(value: ClassificationType) {
        classificationSchema.parse(value); // Fails if value is invalid
        this.value = value;
    }

    public toString(): ClassificationType {
        return this.value;
    }
}
