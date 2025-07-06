import { randomUUID } from 'crypto';

import { Category } from '../../value-objects/category.vo.js';
import { Country } from '../../value-objects/country.vo.js';
import { Classification } from '../../value-objects/story/classification.vo.js';
import { type StoryPerspective } from '../../value-objects/story/perspective/story-perspective.vo.js';
import { Story } from '../story.entity.js';

import { mockPerspectives } from './mock-of-perspectives.js';

/**
 * Creates an array of mock stories for testing purposes
 */
export function getMockStories(count: number): Story[] {
    return Array.from({ length: count }, (_, index) => createMockStory(index));
}

export function getMockStory(options?: {
    category?: Category;
    country?: Country;
    id?: string;
    perspectives?: StoryPerspective[];
}): Story {
    const storyId = options?.id || randomUUID();
    return new Story({
        category: options?.category || new Category('politics'),
        classification: new Classification('PENDING_CLASSIFICATION'),
        country: options?.country || new Country('us'),
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
    const category = getMockStoryCategory(index);
    const storyId = randomUUID();
    return new Story({
        category,
        classification: new Classification('PENDING_CLASSIFICATION'),
        country: new Country('us'),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        perspectives: mockPerspectives(2),
        sourceReferences: [`source-ref-${index}`],
        synopsis: `This is a mock synopsis for story ${index}. It is about ${category.toString()} and provides a comprehensive overview of the key facts and events. This text is intentionally long enough to pass validation.`,
        updatedAt: new Date(),
    });
}

/**
 * Determines the category for a story based on its index
 */
function getMockStoryCategory(index: number): Category {
    return new Category(index % 2 === 0 ? 'politics' : 'technology');
}
