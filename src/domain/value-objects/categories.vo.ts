import { z } from 'zod/v4';

import { Category, type CategoryEnum, categorySchema } from './category.vo.js';

export const categoriesSchema = z
    .array(categorySchema)
    .min(1, 'At least one category is required')
    .refine((categories) => {
        // Remove duplicates and check if any were removed
        const unique = Array.from(new Set(categories));
        return unique.length === categories.length;
    }, 'Categories must be unique');

export type CategoriesArray = z.infer<typeof categoriesSchema>;

export class Categories {
    public readonly values: Category[];

    constructor(categories: (CategoryEnum | string)[]) {
        // Convert all inputs to strings for validation
        const categoryStrings = categories.map((cat): string => {
            return typeof cat === 'string' ? cat : cat;
        });

        const result = categoriesSchema.safeParse(categoryStrings);

        if (!result.success) {
            throw new Error(`Invalid categories: ${result.error.message}`);
        }

        this.values = result.data.map((cat) => new Category(cat));
    }

    public contains(category: CategoryEnum | string): boolean {
        const searchValue = typeof category === 'string' ? new Category(category).value : category;
        return this.values.some((cat) => cat.value === searchValue);
    }

    public count(): number {
        return this.values.length;
    }

    public primary(): Category {
        return this.values[0];
    }

    public toArray(): CategoryEnum[] {
        return this.values.map((cat) => cat.value);
    }

    public toString(): string {
        return this.values.map((cat) => cat.toString()).join(', ');
    }
}
