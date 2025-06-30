import { type NewsStory } from '../providers/news.port.js';

export interface StoryDeduplicationAgentPort {
    readonly name: string;
    run(params: {
        existingStories: Array<{ id: string; synopsis: string }>;
        newStory: NewsStory;
    }): Promise<null | StoryDeduplicationResult>;
}

/**
 * Defines the contract for the Story Deduplication Agent.
 * This agent is responsible for determining if a new story is a semantic
 * duplicate of an existing one.
 */
export type StoryDeduplicationResult = {
    /** The ID of the existing story if it's a duplicate, otherwise null. */
    duplicateOfStoryId: null | string;
};
