import { getDiscourse } from '../../../__mocks__/discourses.mock.js';
import { getStance } from '../../../__mocks__/stances.mock.js';
import { getBody } from '../../__mocks__/bodies.mock.js';
import { getHeadline } from '../../__mocks__/headlines.mock.js';
import { ArticleVariant } from '../article-variant.vo.js';

/**
 * Generates an array of mock `ArticleVariant` instances.
 */
export function mockArticleVariants(count: number): ArticleVariant[] {
    return Array.from(
        { length: count },
        (_, index) =>
            new ArticleVariant({
                body: getBody(index),
                discourse: getDiscourse(index),
                headline: getHeadline(index),
                stance: getStance(index + 2),
            }),
    );
}
