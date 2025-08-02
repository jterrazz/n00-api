import { z } from 'zod/v4';

export const categorySchema = z
    .enum([
        'POLITICS',
        'BUSINESS',
        'TECHNOLOGY',
        'SCIENCE',
        'HEALTH',
        'ENVIRONMENT',
        'SOCIETY',
        'ENTERTAINMENT',
        'SPORTS',
        'OTHER',
    ])
    .describe('Classifies the news report by topic or subject matter.');

export type CategoryEnum = z.infer<typeof categorySchema>;

export class Category {
    public readonly value: CategoryEnum;

    constructor(category: string) {
        const normalizedCategory = category.toUpperCase();
        const result = categorySchema.safeParse(normalizedCategory);

        if (!result.success) {
            this.value = 'OTHER';
        } else {
            this.value = result.data;
        }
    }

    public toString(): CategoryEnum {
        return this.value;
    }
}
