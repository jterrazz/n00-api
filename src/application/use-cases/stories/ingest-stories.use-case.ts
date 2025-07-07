import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Story } from '../../../domain/entities/story.entity.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';
import { Classification } from '../../../domain/value-objects/story/classification.vo.js';
import { Corpus } from '../../../domain/value-objects/story-perspective/corpus.vo.js';
import { StoryPerspective } from '../../../domain/value-objects/story-perspective/story-perspective.vo.js';

import { type StoryDeduplicationAgentPort } from '../../ports/outbound/agents/story-deduplication.agent.js';
import { type StoryIngestionAgentPort } from '../../ports/outbound/agents/story-ingestion.agent.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';
import { type NewsProviderPort } from '../../ports/outbound/providers/news.port.js';

/**
 * Use case for digesting stories from news sources
 */
export class IngestStoriesUseCase {
    constructor(
        private readonly storyIngestionAgent: StoryIngestionAgentPort,
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
            this.logger.info('story:ingest:start', {
                country: country.toString(),
                language: language.toString(),
            });

            // Step 1: Get recent stories and existing source IDs for deduplication
            const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3); // 3 days ago
            const [recentStories, existingSourceReferences] = await Promise.all([
                this.storyRepository.findRecentFacts({ country, language, since }),
                this.storyRepository.getAllSourceReferences(country),
            ]);

            this.logger.info('story:ingest:stats', {
                recentStories: recentStories.length,
                sourceReferences: existingSourceReferences.length,
            });

            // Step 2: Fetch news from external providers
            let newsStories = await this.newsProvider.fetchNews({
                country,
                language,
            });

            newsStories = newsStories.slice(0, 3);

            if (newsStories.length === 0) {
                this.logger.warn('story:ingest:news:none', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }
            this.logger.info('story:ingest:news:fetched', { count: newsStories.length });

            // Step 3: Filter out stories that have already been processed by source ID
            const newNewsStories = newsStories.filter(
                (story) =>
                    !story.articles.some((article) =>
                        existingSourceReferences.includes(article.id),
                    ),
            );

            if (newNewsStories.length === 0) {
                this.logger.info('story:ingest:duplicates:none');
                return [];
            }
            this.logger.info('story:ingest:duplicates:filtered', { count: newNewsStories.length });

            // Step 4: Filter out stories with insufficient articles
            const validNewsStories = newNewsStories.filter((story) => story.articles.length >= 2);

            if (validNewsStories.length === 0) {
                this.logger.warn('story:ingest:invalid:none');
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
                        this.logger.info('story:deduplicated', {
                            duplicateOf: deduplicationResult.duplicateOfStoryId,
                        });
                        await this.storyRepository.addSourceReferences(
                            deduplicationResult.duplicateOfStoryId,
                            newsStory.articles.map((a) => a.id),
                        );
                        continue; // Skip to the next story
                    }

                    // End deduplication check

                    // Step 5.2: Ingest the unique story
                    const ingestionResult = await this.storyIngestionAgent.run({ newsStory });
                    if (!ingestionResult) {
                        this.logger.warn('story:ingest:agent-null', {
                            newsStoryArticles: newsStory.articles.length,
                        });
                        continue;
                    }

                    const storyId = randomUUID();
                    const now = new Date();
                    const perspectives = ingestionResult.perspectives.map(
                        (p) =>
                            new StoryPerspective({
                                discourse: new Discourse(p.discourse),
                                perspectiveCorpus: new Corpus(p.perspectiveCorpus),
                                stance: new Stance(p.stance),
                            }),
                    );

                    const story = new Story({
                        category: ingestionResult.category,
                        classification: new Classification('PENDING_CLASSIFICATION'),
                        country,
                        createdAt: now,
                        dateline: newsStory.publishedAt,
                        facts: ingestionResult.facts,
                        id: storyId,
                        perspectives,
                        sourceReferences: newsStory.articles.map((a) => a.id),
                        updatedAt: now,
                    });

                    const savedStory = await this.storyRepository.create(story);
                    digestedStories.push(savedStory);
                    // Add the newly created story to deduplication tracking for subsequent stories
                    allStoriesForDeduplication.push(savedStory);
                    this.logger.info('story:ingest:ingested', { storyId: savedStory.id });
                } catch (storyError) {
                    this.logger.warn('story:ingest:story:error', {
                        error: storyError,
                    });
                }
            }

            return digestedStories;
        } catch (error) {
            this.logger.error('story:ingest:error', { error });
            throw error;
        }
    }
}
