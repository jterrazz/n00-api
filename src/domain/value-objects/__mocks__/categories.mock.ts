import { Category } from '../category.vo.js';

const CATEGORY_VALUES: Category['value'][] = [
    'POLITICS',
    'BUSINESS',
    'TECHNOLOGY',
    'SCIENCE',
    'HEALTH',
    'ENVIRONMENT',
    'LIFESTYLE',
    'ENTERTAINMENT',
    'SPORTS',
    'OTHER',
];

export const CATEGORY_FIXTURES: Category[] = CATEGORY_VALUES.map((c) => new Category(c));

export function getCategory(index = 0): Category {
    return CATEGORY_FIXTURES[index % CATEGORY_FIXTURES.length];
}
