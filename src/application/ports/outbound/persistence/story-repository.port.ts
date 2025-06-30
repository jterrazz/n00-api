import { type Story } from '../../../../domain/entities/story.entity.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * Repository port for story persistence operations
 */
export interface StoryRepositoryPort {
    /**
     * Appends new source article IDs to an existing story.
     * @param storyId - The ID of the story to update.
     * @param sourceIds - The new source IDs to add.
     */
    addSourceReferences(storyId: string, sourceIds: string[]): Promise<void>;

    /**
     * Create a new story
     */
    create(story: Story): Promise<Story>;

    /**
     * Find a story by ID
     */
    findById(id: string): Promise<null | Story>;

    /**
     * Find stories by criteria
     */
    findMany(criteria: {
        category?: string;
        country?: string;
        endDate?: Date;
        limit?: number;
        offset?: number;
        startDate?: Date;
        where?: {
            interestTier?: 'PENDING_REVIEW';
        };
    }): Promise<Story[]>;

    /**
     * Finds the synopses of recent stories for deduplication purposes.
     * @param options - Criteria to filter the stories.
     */
    findRecentSynopses(options: {
        country: Country;
        language: Language;
        since: Date;
    }): Promise<Array<{ id: string; synopsis: string }>>;

    /**
     * Find stories that don't have any articles linked to them
     * Useful for identifying stories that need article implementation
     */
    findStoriesWithoutArticles(criteria?: {
        category?: string;
        country?: string;
        interestTier?: Array<'NICHE' | 'PENDING_REVIEW' | 'STANDARD'>;
        limit?: number;
    }): Promise<Story[]>;

    /**
     * Get all existing source references (article IDs) to support deduplication
     * Limited to 2000 most recent entries, optionally filtered by country
     */
    getAllSourceReferences(country?: Country): Promise<string[]>;

    /**
     * Update a story's interest tier
     */
    update(id: string, data: { interestTier: 'ARCHIVED' | 'NICHE' | 'STANDARD' }): Promise<void>;
}
