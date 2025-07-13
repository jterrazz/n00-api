import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Article } from '../../../domain/entities/article.entity.js';
import { Authenticity } from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { ArticleFrame } from '../../../domain/value-objects/article-frame/article-frame.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';

import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionInput,
} from '../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleFalsificationAgentPort } from '../../ports/outbound/agents/article-falsification.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article-repository.port.js';
import { type ReportRepositoryPort } from '../../ports/outbound/persistence/report-repository.port.js';

/**
 * Use case for generating articles from reports that don't have articles yet
 * @description Transforms reports into user-facing articles using AI composition
 */
export class GenerateArticlesFromReportsUseCase {
    constructor(
        private readonly articleCompositionAgent: ArticleCompositionAgentPort,
        private readonly articleFalsificationAgent: ArticleFalsificationAgentPort,
        private readonly logger: LoggerPort,
        private readonly reportRepository: ReportRepositoryPort,
        private readonly articleRepository: ArticleRepositoryPort,
    ) {}

    /**
     * Generate articles from reports that don't have articles yet,
     * plus a limited number of fake articles for the game
     * @param language - Target language for article composition
     * @param country - Target country for article composition
     * @returns Array of generated articles (mix of real and fake)
     */
    public async execute(language: Language, country: Country): Promise<Article[]> {
        try {
            this.logger.info('article:generate:start', {
                country: country.toString(),
                language: language.toString(),
            });

            // Find reports that are ready for article generation
            const reportsToProcess = await this.reportRepository.findReportsWithoutArticles({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20, // Process in batches to avoid overwhelming the AI agent
            });

            if (reportsToProcess.length === 0) {
                this.logger.info('article:generate:none', {
                    country: country.toString(),
                    language: language.toString(),
                });
            }

            this.logger.info('article:generate:found', { count: reportsToProcess.length });

            const generatedArticles: Article[] = [];

            // 1) Generate REAL articles (if there are reports)
            if (reportsToProcess.length > 0) {
                for (const report of reportsToProcess) {
                    try {
                        const compositionInput: ArticleCompositionInput = {
                            report,
                            targetCountry: country,
                            targetLanguage: language,
                        };

                        const compositionResult =
                            await this.articleCompositionAgent.run(compositionInput);

                        if (!compositionResult) {
                            this.logger.warn('article:generate:agent-null', {
                                country: country.toString(),
                                language: language.toString(),
                                reportId: report.id,
                            });
                            continue;
                        }

                        const frames = compositionResult.frames.map(
                            (frameData) =>
                                new ArticleFrame({
                                    body: new Body(frameData.body),
                                    discourse: new Discourse(frameData.discourse),
                                    headline: new Headline(frameData.headline),
                                    stance: new Stance(frameData.stance),
                                }),
                        );

                        const article = new Article({
                            authenticity: new Authenticity(false),
                            body: new Body(compositionResult.body),
                            category: report.category,
                            country,
                            frames,
                            headline: new Headline(compositionResult.headline),
                            id: randomUUID(),
                            language,
                            publishedAt: report.dateline,
                            reportIds: [report.id],
                        });

                        generatedArticles.push(article);
                    } catch (articleError) {
                        this.logger.warn('article:generate:error', {
                            country: country.toString(),
                            error: articleError,
                            language: language.toString(),
                            reportId: report.id,
                        });
                    }
                }
            }

            // 2) Generate FAKE articles (may be needed even if no real reports)
            const fakeArticles = await this.generateFakeArticles(language, country);
            generatedArticles.push(...fakeArticles);

            // Persist all newly generated articles in a single batch
            if (generatedArticles.length > 0) {
                try {
                    await this.articleRepository.createMany(generatedArticles);
                } catch (persistError) {
                    this.logger.warn('article:generate:persist-error', {
                        country: country.toString(),
                        error: persistError,
                        language: language.toString(),
                    });
                }
            }

            this.logger.info('article:generate:done', {
                country: country.toString(),
                fakeCount: fakeArticles.length,
                generatedCount: generatedArticles.length,
                language: language.toString(),
                processedCount: reportsToProcess.length,
                realCount: generatedArticles.length - fakeArticles.length,
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

    /**
     * Generate a limited number of fake articles for the game experience
     * @param language - Target language for fake articles
     * @param country - Target country for fake articles
     * @returns Array of fake articles
     */
    private async generateFakeArticles(language: Language, country: Country): Promise<Article[]> {
        const fakeArticles: Article[] = [];

        try {
            // Get recent articles to check if we need fake ones
            const recentArticles = await this.articleRepository.findMany({
                country,
                language,
                limit: 10,
            });

            const existingFakeCount = recentArticles.filter((a) => a.isFalsified()).length;

            // Target ratio: ~25% of articles should be fake.
            const desiredFakeTotal = Math.ceil(recentArticles.length / 3); // nReal /3 ≈ 25% overall
            let generateCount = desiredFakeTotal - existingFakeCount;

            // Clamp between 0 and 3 to avoid large batches
            generateCount = Math.max(0, Math.min(generateCount, 3));

            if (generateCount > 0) {
                this.logger.info('article:generate:fake-needed', {
                    country: country.toString(),
                    fakeCount: generateCount,
                    language: language.toString(),
                    recentArticlesCount: recentArticles.length,
                });

                // Create context from recent articles
                const recentArticlesContext = recentArticles.map((article) => ({
                    body: article.body.value,
                    frames:
                        article.frames?.map((frame) => ({
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
                        const fakeResult = await this.articleFalsificationAgent.run({
                            context: {
                                currentDate: new Date(),
                                recentArticles: recentArticlesContext,
                            },
                            // No targetCategory specified - AI will choose based on context
                            targetCountry: country,
                            targetLanguage: language,
                            tone: 'random', // Mix of serious and satirical
                        });

                        if (!fakeResult) {
                            this.logger.warn('article:generate:fake-agent-null', {
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
                            authenticity: new Authenticity(true, fakeResult.falsificationReason),
                            body: new Body(fakeResult.body),
                            category: fakeResult.category,
                            country,
                            headline: new Headline(fakeResult.headline),
                            id: randomUUID(),
                            language,
                            publishedAt,
                        });

                        this.logger.info('article:generate:fake-composed', {
                            articleId: fakeArticle.id,
                            category: fakeResult.category.toString(),
                            country: country.toString(),
                            headline: fakeArticle.headline.value,
                            language: language.toString(),
                            tone: fakeResult.tone,
                        });

                        fakeArticles.push(fakeArticle);
                    } catch (fakeError) {
                        this.logger.warn('article:generate:fake-error', {
                            country: country.toString(),
                            error: fakeError,
                            language: language.toString(),
                        });
                        // Continue even if fake article generation fails
                    }
                }
            } else {
                this.logger.info('article:generate:fake-skip', {
                    country: country.toString(),
                    language: language.toString(),
                    reason: 'Recent fake article found',
                });
            }
        } catch (error) {
            this.logger.warn('article:generate:fake-check-error', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            // If we can't check, just skip fake generation
        }

        return fakeArticles;
    }
}
