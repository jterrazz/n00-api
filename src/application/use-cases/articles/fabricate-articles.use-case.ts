import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'node:crypto';

// Domain
import { Article } from '../../../domain/entities/article.entity.js';
import type { ArticleFrame } from '../../../domain/value-objects/article-frame/article-frame.vo.js';
import { ArticleTraits } from '../../../domain/value-objects/article-traits.vo.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

// Ports
import { type ArticleFabricationAgentPort } from '../../ports/outbound/agents/article-fabrication.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article/article-repository.port.js';

/**
 * Use case for fabricating fake articles for game experience
 * @description Generates a controlled number of fake articles to maintain a balanced ratio in the content mix
 */
export class FabricateArticlesUseCase {
    constructor(
        private readonly articleFabricationAgent: ArticleFabricationAgentPort,
        private readonly articleRepository: ArticleRepositoryPort,
        private readonly logger: LoggerPort,
    ) {}

    /**
     * Generate and persist a limited number of fake articles for the game experience
     * @param language - Target language for fake articles
     * @param country - Target country for fake articles
     * @returns Array of fabricated articles
     */
    public async execute(language: Language, country: Country): Promise<Article[]> {
        const fakeArticles: Article[] = [];

        try {
            // Require a minimum baseline of existing articles for this locale before fabricating
            const totalForLocale = await this.articleRepository.countMany({
                country,
                language,
            });

            if (totalForLocale < 10) {
                this.logger.info('Skipping fake article generation', {
                    country: country.toString(),
                    language: language.toString(),
                    reason: 'Insufficient baseline articles',
                    totalForLocale,
                });
                return fakeArticles;
            }

            // Get recent articles to check if we need fake ones
            const recentArticles = await this.articleRepository.findMany({
                country,
                language,
                limit: 10,
            });

            const existingFakeCount = recentArticles.filter((a) => a.isFabricated()).length;

            // Target ratio: ~10% of articles should be fake.
            // We base this on the count of **real** articles to avoid skew from existing fakes.
            const realArticleCount = recentArticles.length - existingFakeCount;
            // To reach ~10% overall, we need roughly one fake for every nine real articles (nReal / 9).
            const desiredFakeTotal = Math.ceil(realArticleCount / 9); // nReal /9 ≈ 10% overall
            let generateCount = desiredFakeTotal - existingFakeCount;

            // Clamp between 0 and 3 to avoid large batches
            generateCount = Math.max(0, Math.min(generateCount, 3));

            if (generateCount > 0) {
                this.logger.info('Fake articles will be generated', {
                    country: country.toString(),
                    fakeCount: generateCount,
                    language: language.toString(),
                    recentArticlesCount: recentArticles.length,
                });

                // Create context from recent articles
                const recentArticlesContext = recentArticles.map((article) => ({
                    body: article.body.value,
                    frames:
                        article.frames?.map((frame: ArticleFrame) => ({
                            body: frame.body.value,
                            headline: frame.headline.value,
                        })) || [],
                    headline: article.headline.value,
                    publishedAt: article.publishedAt.toISOString(),
                }));

                // Generate the fake articles
                for (let i = 0; i < generateCount; i++) {
                    try {
                        // Let AI choose the category based on recent articles context
                        const fakeResult = await this.articleFabricationAgent.run({
                            context: {
                                currentDate: new Date(),
                                recentArticles: recentArticlesContext,
                            },
                            // No targetCategory specified - AI will choose based on context
                            targetCountry: country,
                            targetLanguage: language,
                        });

                        if (!fakeResult) {
                            this.logger.warn('Fabrication agent returned no result', {
                                country: country.toString(),
                                language: language.toString(),
                            });
                            continue;
                        }

                        // Determine publication date so the fake article blends naturally
                        let publishedAt: Date;

                        if (
                            recentArticles.length > 0 &&
                            typeof fakeResult.insertAfterIndex === 'number'
                        ) {
                            const targetIdx = fakeResult.insertAfterIndex;

                            // Clamp index to valid range ( -1 .. recentArticles.length - 1 )
                            const safeIdx = Math.max(
                                -1,
                                Math.min(targetIdx, recentArticles.length - 1),
                            );

                            // Choose the base article after which we insert; if -1, place before first article
                            const baseArticleDate =
                                safeIdx === -1
                                    ? recentArticles[0].publishedAt
                                    : recentArticles[safeIdx].publishedAt;

                            // Offset between 2 and 10 minutes to keep timeline realistic
                            const offsetMinutes = 2 + Math.random() * 8;
                            const offsetMs = offsetMinutes * 60 * 1000;

                            publishedAt = new Date(baseArticleDate.getTime() + offsetMs);

                            // Ensure we don't place articles in the future beyond now
                            const now = new Date();
                            if (publishedAt > now) {
                                publishedAt = new Date(now.getTime() - 60 * 1000); // 1 minute before now
                            }
                        } else {
                            // Fallback: Within last 24 hours
                            publishedAt = new Date(
                                Date.now() - Math.random() * 24 * 60 * 60 * 1000,
                            );
                        }

                        // Create fake article entity
                        const fakeArticle = new Article({
                            // Empty attributes for fabricated content
                            authenticity: new Authenticity(
                                AuthenticityStatusEnum.FABRICATED,
                                fakeResult.clarification,
                            ),
                            body: new Body(fakeResult.body),
                            categories: fakeResult.categories,
                            country,
                            headline: new Headline(fakeResult.headline),
                            id: randomUUID(),
                            language,
                            publishedAt,
                            traits: new ArticleTraits(),
                        });

                        this.logger.info('Fake article composed', {
                            articleId: fakeArticle.id,
                            category: fakeResult.categories.primary().toString(),
                            country: country.toString(),
                            headline: fakeArticle.headline.value,
                            language: language.toString(),
                            tone: fakeResult.tone,
                        });

                        fakeArticles.push(fakeArticle);
                    } catch (fakeError) {
                        this.logger.warn('Error generating fake article', {
                            country: country.toString(),
                            error: fakeError,
                            language: language.toString(),
                        });
                        // Continue even if fake article generation fails
                    }
                }

                // Persist the generated fake articles
                if (fakeArticles.length > 0) {
                    try {
                        await this.articleRepository.createMany(fakeArticles);
                        this.logger.info('Fake articles persisted successfully', {
                            count: fakeArticles.length,
                            country: country.toString(),
                            language: language.toString(),
                        });
                    } catch (persistError) {
                        this.logger.warn('Error persisting fake articles', {
                            country: country.toString(),
                            error: persistError,
                            language: language.toString(),
                        });
                        throw persistError; // Re-throw since this is a critical error
                    }
                }
            } else {
                this.logger.info('Skipping fake article generation', {
                    country: country.toString(),
                    language: language.toString(),
                    reason: 'Recent fake article ratio already satisfied',
                });
            }
        } catch (error) {
            this.logger.warn('Error checking fake article requirements', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            // If we can't check, just skip fake generation and return empty array
        }

        return fakeArticles;
    }
}
