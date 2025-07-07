import { randomUUID } from 'crypto';

import { getCategory } from '../../value-objects/__mocks__/categories.mock.js';
import { getCountry } from '../../value-objects/__mocks__/countries.mock.js';
import { getLanguage } from '../../value-objects/__mocks__/languages.mock.js';
import { getBody } from '../../value-objects/article/__mocks__/bodies.mock.js';
import { getHeadline } from '../../value-objects/article/__mocks__/headlines.mock.js';
import { Authenticity } from '../../value-objects/article/authenticity.vo.js';
import { mockArticleVariants } from '../../value-objects/article/variant/__mocks__/article-variants.mock.js';
import { Article } from '../article.entity.js';

/**
 * Generates a single mock `Article`.
 */
export function createMockArticle(index: number): Article {
    return new Article({
        authenticity: new Authenticity(false),
        body: getBody(index),
        category: getCategory(index),
        country: getCountry(index),
        headline: getHeadline(index),
        id: randomUUID(),
        language: getLanguage(index),
        publishedAt: new Date(),
        storyIds: [],
        variants: mockArticleVariants(2),
    });
}

/**
 * Generates an array of mock `Article` domain entities.
 */
export function mockArticles(count: number): Article[] {
    return Array.from({ length: count }, (_, index) => createMockArticle(index));
}
