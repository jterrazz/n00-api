import { z } from 'zod/v4';

export const backgroundSchema = z.string().min(10);

export type BackgroundValue = z.infer<typeof backgroundSchema>;

export class Background {
    public readonly value: BackgroundValue;

    constructor(value: string) {
        const result = backgroundSchema.safeParse(value);

        if (!result.success) {
            throw new Error(`Invalid background context: ${result.error.message}`);
        }

        this.value = result.data;
    }

    public toString(): string {
        return this.value;
    }
}
