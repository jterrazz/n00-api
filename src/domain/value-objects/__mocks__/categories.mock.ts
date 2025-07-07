import { Category } from '../category.vo.js';

const CATEGORY_VALUES: Category['value'][] = [
    'politics',
    'business',
    'technology',
    'science',
    'health',
    'environment',
    'society',
    'entertainment',
    'sports',
    'other',
];

export const CATEGORY_FIXTURES: Category[] = CATEGORY_VALUES.map((c) => new Category(c));

export function getCategory(index = 0): Category {
    return CATEGORY_FIXTURES[index % CATEGORY_FIXTURES.length];
}

export function randomCategory(): Category {
    return CATEGORY_FIXTURES[Math.floor(Math.random() * CATEGORY_FIXTURES.length)];
}
