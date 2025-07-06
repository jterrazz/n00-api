import { randomUUID } from 'crypto';

import { Category } from '../../value-objects/category.vo.js';
import { Country } from '../../value-objects/country.vo.js';
import { Classification } from '../../value-objects/story/classification.vo.js';
import { type Perspective } from '../perspective.entity.js';
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
    perspectives?: Perspective[];
}): Story {
    const storyId = options?.id || randomUUID();
    return new Story({
        category: options?.category || new Category('politics'),
        classification: new Classification('PENDING_CLASSIFICATION'),
        country: options?.country || new Country('us'),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        perspectives: options?.perspectives || mockPerspectives(1, storyId),
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
        perspectives: mockPerspectives(2, storyId),
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

/**
 * Generates mock story synopses based on category
 */
function getMockStorySynopsis(index: number): string {
    const synopses = [
        'A comprehensive political analysis examining stakeholder perspectives on policy implementation across affected regions. Government responses, opposition viewpoints, citizen concerns, and international reactions shape the evolving narrative.',
        'In-depth technological coverage examining societal impact with industry expert viewpoints, regulatory perspectives, and public advocacy positions. Market disruption concerns and innovation opportunities drive complex discussions.',
        'Detailed economic examination of trends and movements featuring financial institution analysis, government agency perspectives, and independent research insights. Employment impacts and monetary policy implications remain central.',
        'Thorough environmental investigation of policy changes incorporating scientific community perspectives, environmental group positions, and industry representative viewpoints. Climate assessments and conservation efforts dominate discourse.',
        'Complete social policy assessment analyzing community impact through demographic group positions, advocacy organization perspectives, and policy expert analysis. Implementation challenges and community benefits drive evaluation.',
        'Comprehensive international relations review examining global implications through diplomatic, economic, and security perspectives from multiple nations. Treaty negotiations and trade relationships shape international cooperation.',
        'Detailed healthcare analysis of system changes examining public health consequences through medical professional insights, patient advocacy perspectives, and healthcare administrator viewpoints on treatment accessibility.',
        'In-depth educational examination of policy reforms analyzing learning outcome impacts through educator perspectives, parent viewpoints, student positions, and education researcher insights on curriculum changes.',
    ];

    return synopses[index % synopses.length];
}
