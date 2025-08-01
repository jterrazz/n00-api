import { getStance } from '../../__mocks__/stances.mock.js';
import { getBody } from '../../article/__mocks__/bodies.mock.js';
import { getHeadline } from '../../article/__mocks__/headlines.mock.js';
import { ArticleFrame } from '../article-frame.vo.js';

/**
 * Generates a single mock `ArticleFrame` instance.
 */
export function createMockArticleFrame(index: number): ArticleFrame {
    return new ArticleFrame({
        body: getBody(index),
        headline: getHeadline(index),
        stance: getStance(index),
    });
}

/**
 * Generates an array of mock `ArticleFrame` instances.
 */
export function mockArticleFrames(count: number): ArticleFrame[] {
    return Array.from({ length: count }, (_, index) => createMockArticleFrame(index));
}
