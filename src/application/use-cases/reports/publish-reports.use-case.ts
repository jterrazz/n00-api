import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

// Domain
import { Article } from '../../../domain/entities/article.entity.js';
import { ArticleFrame } from '../../../domain/value-objects/article-frame/article-frame.vo.js';
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
import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionInput,
} from '../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article/article-repository.port.js';
import { type ReportRepositoryPort } from '../../ports/outbound/persistence/report/report-repository.port.js';

import { type FabricateArticlesUseCase } from '../articles/fabricate-articles.use-case.js';

/**
 * Use case for publishing reports as user-facing articles
 * @description Transforms reports into articles using AI composition
 */
export class PublishReportsUseCase {
    constructor(
        private readonly articleCompositionAgent: ArticleCompositionAgentPort,
        private readonly fabricateArticlesUseCase: FabricateArticlesUseCase,
        private readonly logger: LoggerPort,
        private readonly reportRepository: ReportRepositoryPort,
        private readonly articleRepository: ArticleRepositoryPort,
    ) {}

    /**
     * Publish reports as articles by generating content from unpublished reports,
     * plus a limited number of fake articles for the game
     * @param language - Target language for article composition
     * @param country - Target country for article composition
     * @returns Array of published articles (mix of real and fake)
     */
    public async execute(language: Language, country: Country): Promise<Article[]> {
        try {
            this.logger.info('Starting report publishing process', {
                country: country.toString(),
                language: language.toString(),
            });

            // Find reports that are ready for publishing
            const reportsToProcess = await this.reportRepository.findReportsWithoutArticles({
                country: country.toString(),
                limit: 20, // Process in batches to avoid overwhelming the AI agent
                tier: ['GENERAL', 'NICHE'],
            });

            if (reportsToProcess.length === 0) {
                this.logger.info('No reports found for publishing', {
                    country: country.toString(),
                    language: language.toString(),
                });
            }

            this.logger.info('Reports found for publishing', {
                count: reportsToProcess.length,
            });

            const publishedArticles: Article[] = [];

            // 1) Publish REAL articles (if there are reports)
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
                            this.logger.warn('Composition agent returned no result', {
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
                                    headline: new Headline(frameData.headline),
                                }),
                        );

                        const article = new Article({
                            authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                            body: new Body(compositionResult.body),
                            categories: report.categories,
                            country,
                            frames,
                            headline: new Headline(compositionResult.headline),
                            id: randomUUID(),
                            language,
                            publishedAt: report.dateline,
                            reportIds: [report.id],
                            traits: report.traits || new ArticleTraits(), // Use report traits if available, otherwise default
                        });

                        publishedArticles.push(article);
                    } catch (articleError) {
                        this.logger.warn('Error publishing article from report', {
                            country: country.toString(),
                            error: articleError,
                            language: language.toString(),
                            reportId: report.id,
                        });
                    }
                }
            }

            // Persist real articles before generating fakes so that fake-generation ratio has context
            if (publishedArticles.length > 0) {
                try {
                    await this.articleRepository.createMany(publishedArticles);
                } catch (persistError) {
                    this.logger.warn('Error persisting real articles', {
                        country: country.toString(),
                        error: persistError,
                        language: language.toString(),
                    });
                }
            }

            // 2) Generate FAKE articles (may be needed even if no real reports)
            const fakeArticles = await this.fabricateArticlesUseCase.execute(language, country);

            // Combine for return and logging
            const allPublished = [...publishedArticles, ...fakeArticles];

            this.logger.info('Report publishing process completed', {
                country: country.toString(),
                fakeCount: fakeArticles.length,
                language: language.toString(),
                processedCount: reportsToProcess.length,
                publishedCount: allPublished.length,
                realCount: publishedArticles.length,
            });

            return allPublished;
        } catch (error) {
            this.logger.error('Report publishing encountered an error', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            throw error;
        }
    }
}
