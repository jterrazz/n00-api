import { randomUUID } from 'crypto';

import { getCategory } from '../../value-objects/__mocks__/categories.mock.js';
import { getCountry } from '../../value-objects/__mocks__/countries.mock.js';
import { getClassification } from '../../value-objects/story/__mocks__/classifications.mock.js';
import { mockStoryPerspectives as mockPerspectives } from '../../value-objects/story/perspective/__mocks__/story-perspectives.mock.js';
import { type StoryPerspective } from '../../value-objects/story/perspective/story-perspective.vo.js';
import { Story } from '../story.entity.js';

/**
 * Generates an array of mock `Story` entities.
 */
export function getMockStories(count: number): Story[] {
    return Array.from({ length: count }, (_, index) => createMockStory(index));
}

/**
 * Generates a single mock `Story` with optional overrides.
 */
export function getMockStory(options?: {
    categoryIndex?: number;
    classificationIndex?: number;
    countryIndex?: number;
    id?: string;
    perspectives?: StoryPerspective[];
}): Story {
    const storyId = options?.id || randomUUID();
    return new Story({
        category:
            options?.categoryIndex !== undefined
                ? getCategory(options.categoryIndex)
                : getCategory(0),
        classification:
            options?.classificationIndex !== undefined
                ? getClassification(options.classificationIndex)
                : getClassification(2),
        country:
            options?.countryIndex !== undefined ? getCountry(options.countryIndex) : getCountry(0),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        perspectives: options?.perspectives || mockPerspectives(1),
        sourceReferences: ['worldnewsapi:mock-article-1', 'worldnewsapi:mock-article-2'],
        synopsis:
            'Mock Story Synopsis: A comprehensive analysis of current political developments across multiple regions, examining the various perspectives and stakeholder positions that shape public discourse on this evolving situation.',
        updatedAt: new Date(),
    });
}

function createMockStory(index: number): Story {
    const category = getCategory(index);
    const classification = getClassification(index + 1);
    const storyId = randomUUID();
    return new Story({
        category,
        classification,
        country: getCountry(index + 1),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        perspectives: mockPerspectives(2),
        sourceReferences: [`source-ref-${index}`],
        synopsis: `This is a mock synopsis for story ${index}. It is about ${category.toString()} and provides a comprehensive overview of the key facts and events. This text is intentionally long enough to pass validation.`,
        updatedAt: new Date(),
    });
}
