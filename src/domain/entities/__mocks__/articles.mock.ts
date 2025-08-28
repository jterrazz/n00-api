import { randomUUID } from 'node:crypto';

import { getCategory } from '../../value-objects/__mocks__/categories.mock.js';
import { getCountry } from '../../value-objects/__mocks__/countries.mock.js';
import { getLanguage } from '../../value-objects/__mocks__/languages.mock.js';
import { mockArticleFrames } from '../../value-objects/article-frame/__mocks__/article-frames.mock.js';
import { ArticleTraits } from '../../value-objects/article-traits.vo.js';
import { getBody } from '../../value-objects/article/__mocks__/bodies.mock.js';
import { getHeadline } from '../../value-objects/article/__mocks__/headlines.mock.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../value-objects/article/authenticity.vo.js';
import { Categories } from '../../value-objects/categories.vo.js';
import { Article } from '../article.entity.js';

/**
 * Generates a single mock `Article`.
 */
export function createMockArticle(index: number): Article {
    return new Article({
        authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
        body: getBody(index),
        categories: new Categories([getCategory(index).value]),
        country: getCountry(index),
        frames: mockArticleFrames(2),
        headline: getHeadline(index),
        id: randomUUID(),
        language: getLanguage(index),
        publishedAt: new Date(),
        reportIds: [],
        traits: new ArticleTraits(),
    });
}

/**
 * Generates an array of mock `Article` domain entities.
 */
export function mockArticles(count: number): Article[] {
    return Array.from({ length: count }, (_, index) => createMockArticle(index));
}
