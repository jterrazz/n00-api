import { z } from 'zod/v4';

export const coreSchema = z.string().min(10);

export type CoreValue = z.infer<typeof coreSchema>;

export class Core {
    public readonly value: CoreValue;

    constructor(value: string) {
        const result = coreSchema.safeParse(value);

        if (!result.success) {
            throw new Error(`Invalid core story: ${result.error.message}`);
        }

        this.value = result.data;
    }

    public toString(): string {
        return this.value;
    }
}
