import { z } from 'zod/v4';

/**
 * Zod schema for the DeduplicationState. It validates that the state
 * is one of the allowed string literals.
 */
export const deduplicationStateSchema = z.enum(['PENDING', 'COMPLETE']);

export type DeduplicationStateType = z.infer<typeof deduplicationStateSchema>;

/**
 * @description
 * Represents the state of the deduplication process for a report.
 * Used to track whether deduplication step has been completed.
 *
 * @example
 * const state = new DeduplicationState('PENDING');
 */
export class DeduplicationState {
    public readonly value: DeduplicationStateType;

    constructor(value: DeduplicationStateType) {
        deduplicationStateSchema.parse(value); // Fails if value is invalid
        this.value = value;
    }

    public isComplete(): boolean {
        return this.value === 'COMPLETE';
    }

    public isPending(): boolean {
        return this.value === 'PENDING';
    }

    public toString(): DeduplicationStateType {
        return this.value;
    }
}
