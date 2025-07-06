import { PerspectiveCorpus } from '../../value-objects/story/perspective/perspective-corpus.vo.js';
import { PerspectiveTags } from '../../value-objects/story/perspective/perspective-tags.vo.js';
import { StoryPerspective } from '../../value-objects/story/perspective/story-perspective.vo.js';

/**
 * Creates an array of mock perspectives for a given story
 */
export function mockPerspectives(count: number): StoryPerspective[] {
    return Array.from({ length: count }, (_, index) => createMockPerspective(index));
}

/**
 * Creates a single mock perspective with the given parameters
 */
function createMockPerspective(index: number): StoryPerspective {
    return new StoryPerspective({
        perspectiveCorpus: new PerspectiveCorpus(
            `This is a detailed and complete holistic digest for perspective number ${index + 1}. It contains a comprehensive compilation of all information related to this specific viewpoint, including every argument, fact, and piece of evidence presented. This text is intentionally long to satisfy the minimum length validation requirements of the domain value object and to provide a realistic piece of text for testing purposes.`,
        ),
        tags: new PerspectiveTags({
            stance: index % 2 === 0 ? 'critical' : 'supportive',
        }),
    });
}
