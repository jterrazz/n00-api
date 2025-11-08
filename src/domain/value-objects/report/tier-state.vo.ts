import { z } from 'zod/v4';

/**
 * Zod schema for the ClassificationState. It validates that the state
 * is one of the allowed string literals.
 */
export const classificationStateSchema = z.enum(['PENDING', 'COMPLETE']);

export type ClassificationStateType = z.infer<typeof classificationStateSchema>;

/**
 * @description
 * Represents the state of the classification process for a report.
 * Used to track whether classification step has been completed.
 *
 * @example
 * const state = new ClassificationState('PENDING');
 */
export class ClassificationState {
    public readonly value: ClassificationStateType;

    constructor(value: ClassificationStateType) {
        classificationStateSchema.parse(value); // Fails if value is invalid
        this.value = value;
    }

    public isComplete(): boolean {
        return this.value === 'COMPLETE';
    }

    public isPending(): boolean {
        return this.value === 'PENDING';
    }

    public toString(): ClassificationStateType {
        return this.value;
    }
}
