import { z } from 'zod/v4';

/**
 * Zod schema for the Classification. It validates that the classification
 * is one of the allowed string literals.
 */
export const classificationSchema = z.enum([
    'STANDARD',
    'NICHE',
    'PENDING_CLASSIFICATION',
    'ARCHIVED',
]);

export type ClassificationType = z.infer<typeof classificationSchema>;

/**
 * @description
 * Represents the classification of a story, determining its
 * potential audience appeal and placement priority.
 *
 * @example
 * const classification = new Classification('STANDARD');
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
