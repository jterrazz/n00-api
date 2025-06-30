import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Perspective } from '../../../domain/entities/perspective.entity.js';
import { type Story } from '../../../domain/entities/story.entity.js';
import { Story as StoryEntity } from '../../../domain/entities/story.entity.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';
import { InterestTier } from '../../../domain/value-objects/story/interest-tier.vo.js';

import { type StoryDeduplicationAgentPort } from '../../ports/outbound/agents/story-deduplication.agent.js';
import { type StoryDigestAgentPort } from '../../ports/outbound/agents/story-digest.agent.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';
import { type NewsProviderPort } from '../../ports/outbound/providers/news.port.js';

/**
 * Use case for digesting stories from news sources
 */
export class DigestStoriesUseCase {
    constructor(
        private readonly storyDigestAgent: StoryDigestAgentPort,
        private readonly storyDeduplicationAgent: StoryDeduplicationAgentPort,
        private readonly logger: LoggerPort,
        private readonly newsProvider: NewsProviderPort,
        private readonly storyRepository: StoryRepositoryPort,
    ) {}

    /**
     * Digest stories for a specific language and country
     */
    public async execute(language: Language, country: Country): Promise<Story[]> {
        try {
            this.logger.info('Starting story digestion', {
                country: country.toString(),
                language: language.toString(),
            });

            // Step 1: Get recent stories and existing source IDs for deduplication
            const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3); // 3 days ago
            const [recentStories, existingSourceReferences] = await Promise.all([
                this.storyRepository.findRecentSynopses({ country, language, since }),
                this.storyRepository.getAllSourceReferences(country),
            ]);

            this.logger.info(
                `Found ${recentStories.length} recent stories and ${existingSourceReferences.length} source references to check for duplicates.`,
            );

            // Step 2: Fetch news from external providers
            const newsStories = await this.newsProvider.fetchNews({
                country,
                language,
            });

            if (newsStories.length === 0) {
                this.logger.warn('No news stories found', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }
            this.logger.info(`Retrieved ${newsStories.length} news stories from providers.`);

            // Step 3: Filter out stories that have already been processed by source ID
            const newNewsStories = newsStories.filter(
                (story) =>
                    !story.articles.some((article) =>
                        existingSourceReferences.includes(article.id),
                    ),
            );

            if (newNewsStories.length === 0) {
                this.logger.info('No new stories to process after source ID deduplication.');
                return [];
            }
            this.logger.info(`Found ${newNewsStories.length} new stories after source ID filter.`);

            // Step 4: Filter out stories with insufficient articles
            const validNewsStories = newNewsStories.filter((story) => story.articles.length >= 2);

            if (validNewsStories.length === 0) {
                this.logger.warn('No valid news stories after article count filtering.');
                return [];
            }

            // Step 5: Process each valid news story
            const digestedStories: Story[] = [];
            // Track all stories for deduplication (existing + newly processed in this batch)
            const allStoriesForDeduplication = [...recentStories];

            for (const newsStory of validNewsStories) {
                try {
                    // Step 5.1: Check for semantic duplicates (including newly processed stories)
                    const deduplicationResult = await this.storyDeduplicationAgent.run({
                        existingStories: allStoriesForDeduplication,
                        newStory: newsStory,
                    });

                    if (deduplicationResult?.duplicateOfStoryId) {
                        this.logger.info(
                            `Found semantic duplicate. Merging into story ${deduplicationResult.duplicateOfStoryId}.`,
                        );
                        await this.storyRepository.addSourceReferences(
                            deduplicationResult.duplicateOfStoryId,
                            newsStory.articles.map((a) => a.id),
                        );
                        continue; // Skip to the next story
                    }

                    // Step 5.2: Digest the unique story
                    const digestResult = await this.storyDigestAgent.run({ newsStory });
                    if (!digestResult) {
                        this.logger.warn('AI digest agent returned null.', {
                            newsStoryArticles: newsStory.articles.length,
                        });
                        continue;
                    }

                    const storyId = randomUUID();
                    const now = new Date();
                    const perspectives = digestResult.perspectives.map(
                        (p) =>
                            new Perspective({
                                ...p,
                                createdAt: now,
                                id: randomUUID(),
                                storyId,
                                updatedAt: now,
                            }),
                    );

                    const story = new StoryEntity({
                        category: digestResult.category,
                        country,
                        createdAt: now,
                        dateline: newsStory.publishedAt,
                        id: storyId,
                        interestTier: new InterestTier('PENDING_REVIEW'),
                        perspectives,
                        sourceReferences: newsStory.articles.map((a) => a.id),
                        synopsis: digestResult.synopsis,
                        updatedAt: now,
                    });

                    const savedStory = await this.storyRepository.create(story);
                    digestedStories.push(savedStory);
                    // Add the newly created story to deduplication tracking for subsequent stories
                    allStoriesForDeduplication.push(savedStory);
                    this.logger.info(`Successfully digested and saved new story ${savedStory.id}.`);
                } catch (storyError) {
                    this.logger.warn('Failed to process individual news story.', {
                        error: storyError,
                    });
                }
            }

            return digestedStories;
        } catch (error) {
            this.logger.error('Failed to complete story digestion process.', { error });
            throw error;
        }
    }
}
