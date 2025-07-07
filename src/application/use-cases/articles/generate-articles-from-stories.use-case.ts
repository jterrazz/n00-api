import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Article } from '../../../domain/entities/article.entity.js';
import { Authenticity } from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { ArticleVariant } from '../../../domain/value-objects/article-variant/article-variant.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';

import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionInput,
} from '../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article-repository.port.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';

/**
 * Use case for generating articles from stories that don't have articles yet
 * @description Transforms stories into user-facing articles using AI composition
 */
export class GenerateArticlesFromStoriesUseCase {
    constructor(
        private readonly articleCompositionAgent: ArticleCompositionAgentPort,
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
            this.logger.info('article:generate:start', {
                country: country.toString(),
                language: language.toString(),
            });

            // Find stories that are ready for article generation
            const storiesToProcess = await this.storyRepository.findStoriesWithoutArticles({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20, // Process in batches to avoid overwhelming the AI agent
            });

            if (storiesToProcess.length === 0) {
                this.logger.info('article:generate:none', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }

            this.logger.info('article:generate:found', { count: storiesToProcess.length });

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
                    const compositionResult =
                        await this.articleCompositionAgent.run(compositionInput);

                    if (!compositionResult) {
                        this.logger.warn('article:generate:agent-null', {
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
                                discourse: new Discourse(variantData.discourse),
                                headline: new Headline(variantData.headline),
                                stance: new Stance(variantData.stance),
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

                    this.logger.info('article:generate:composed', {
                        articleId: article.id,
                        country: country.toString(),
                        headline: article.headline.value,
                        language: language.toString(),
                        storyId: story.id,
                        variantsCount: variants.length,
                    });

                    generatedArticles.push(article);
                } catch (articleError) {
                    this.logger.warn('article:generate:error', {
                        country: country.toString(),
                        error: articleError,
                        language: language.toString(),
                        storyId: story.id,
                    });
                    // Continue processing other stories even if one fails
                }
            }

            this.logger.info('article:generate:done', {
                country: country.toString(),
                generatedCount: generatedArticles.length,
                language: language.toString(),
                processedCount: storiesToProcess.length,
            });

            return generatedArticles;
        } catch (error) {
            this.logger.error('article:generate:error', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            throw error;
        }
    }
}
