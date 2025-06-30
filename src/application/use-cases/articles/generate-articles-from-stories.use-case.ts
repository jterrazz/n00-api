import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Article } from '../../../domain/entities/article.entity.js';
import { ArticleVariant } from '../../../domain/value-objects/article/article-variant.vo.js';
import { Authenticity } from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

import {
    type ArticleComposerAgentPort,
    type ArticleCompositionInput,
} from '../../ports/outbound/agents/article-composer.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article-repository.port.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';

/**
 * Use case for generating articles from stories that don't have articles yet
 * @description Transforms stories into user-facing articles using AI composition
 */
export class GenerateArticlesFromStoriesUseCase {
    constructor(
        private readonly articleComposerAgent: ArticleComposerAgentPort,
        private readonly logger: LoggerPort,
        private readonly storyRepository: StoryRepositoryPort,
        private readonly articleRepository: ArticleRepositoryPort,
    ) {}

    /**
     * Generate articles from stories that don't have articles yet
     * @param language - Target language for article composition
     * @param country - Target country for article composition
     * @returns Array of generated articles
     */
    public async execute(language: Language, country: Country): Promise<Article[]> {
        try {
            this.logger.info('Starting article composition from stories', {
                country: country.toString(),
                language: language.toString(),
            });

            // Find stories that are ready for article generation
            const storiesToProcess = await this.storyRepository.findStoriesWithoutArticles({
                country: country.toString(),
                interestTier: ['STANDARD', 'NICHE'],
                limit: 20, // Process in batches to avoid overwhelming the AI agent
            });

            if (storiesToProcess.length === 0) {
                this.logger.info('No stories found ready for article generation.', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }

            this.logger.info(`Found ${storiesToProcess.length} stories to process.`);

            // Generate articles for each story
            const generatedArticles: Article[] = [];

            for (const story of storiesToProcess) {
                try {
                    const compositionInput: ArticleCompositionInput = {
                        story,
                        targetCountry: country,
                        targetLanguage: language,
                    };

                    // Generate article using AI agent
                    const compositionResult = await this.articleComposerAgent.run(compositionInput);

                    if (!compositionResult) {
                        this.logger.warn('AI agent returned null for story', {
                            country: country.toString(),
                            language: language.toString(),
                            storyId: story.id,
                        });
                        continue;
                    }

                    // Create article variants from composition result
                    const variants = compositionResult.variants.map(
                        (variantData) =>
                            new ArticleVariant({
                                body: new Body(variantData.body),
                                discourse: variantData.discourse as
                                    | 'alternative'
                                    | 'dubious'
                                    | 'mainstream'
                                    | 'underreported',
                                headline: new Headline(variantData.headline),
                                stance: variantData.stance as
                                    | 'concerned'
                                    | 'critical'
                                    | 'mixed'
                                    | 'neutral'
                                    | 'optimistic'
                                    | 'skeptical'
                                    | 'supportive',
                            }),
                    );

                    // Create article domain entity
                    const article = new Article({
                        authenticity: new Authenticity(false), // Always neutral/factual articles
                        body: new Body(compositionResult.body),
                        category: story.category,
                        country,
                        headline: new Headline(compositionResult.headline),
                        id: randomUUID(),
                        language,
                        publishedAt: story.dateline, // Use story's dateline as article publication date
                        storyIds: [story.id], // Link back to the source story
                        variants, // Include the variants
                    });

                    // Save the article
                    await this.articleRepository.createMany([article]);

                    this.logger.info('Composed article from story', {
                        articleId: article.id,
                        country: country.toString(),
                        headline: article.headline.value,
                        language: language.toString(),
                        storyId: story.id,
                        variantsCount: variants.length,
                    });

                    generatedArticles.push(article);
                } catch (articleError) {
                    this.logger.warn('Failed to compose article for story', {
                        country: country.toString(),
                        error: articleError,
                        language: language.toString(),
                        storyId: story.id,
                    });
                    // Continue processing other stories even if one fails
                }
            }

            this.logger.info('Article composition completed', {
                country: country.toString(),
                generatedCount: generatedArticles.length,
                language: language.toString(),
                processedCount: storiesToProcess.length,
            });

            return generatedArticles;
        } catch (error) {
            this.logger.error('Failed to compose articles from stories', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            throw error;
        }
    }
}
