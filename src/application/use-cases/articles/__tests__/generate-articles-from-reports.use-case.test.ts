import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { getMockReports } from '../../../../domain/entities/__mocks__/reports.mock.js';
import { Article } from '../../../../domain/entities/article.entity.js';
import { type Report } from '../../../../domain/entities/report.entity.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../../domain/value-objects/article/headline.vo.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionResult,
} from '../../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleFalsificationAgentPort } from '../../../ports/outbound/agents/article-falsification.agent.js';
import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article-repository.port.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report-repository.port.js';

import { GenerateArticlesFromReportsUseCase } from '../generate-articles-from-reports.use-case.js';

describe('GenerateArticlesFromReportsUseCase', () => {
    // Test constants
    const DEFAULT_COUNTRY = new Country('us');
    const DEFAULT_LANGUAGE = new Language('en');
    const TEST_REPORTS_COUNT = 3;

    // Test fixtures
    let mockArticleCompositionAgent: DeepMockProxy<ArticleCompositionAgentPort>;
    let mockArticleFalsificationAgent: DeepMockProxy<ArticleFalsificationAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;
    let useCase: GenerateArticlesFromReportsUseCase;
    let testReports: Report[];
    let mockCompositionResults: ArticleCompositionResult[];

    beforeEach(() => {
        mockArticleCompositionAgent = mock<ArticleCompositionAgentPort>();
        mockArticleFalsificationAgent = mock<ArticleFalsificationAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockReportRepository = mock<ReportRepositoryPort>();
        mockArticleRepository = mock<ArticleRepositoryPort>();

        useCase = new GenerateArticlesFromReportsUseCase(
            mockArticleCompositionAgent,
            mockArticleFalsificationAgent,
            mockLogger,
            mockReportRepository,
            mockArticleRepository,
        );

        testReports = getMockReports(TEST_REPORTS_COUNT);

        // Create mock composition results
        mockCompositionResults = testReports.map((report, index) => ({
            body: `Composed article body for report ${index + 1} with neutral presentation of facts from all angles.`,
            categories: report.categories,
            frames: [
                {
                    body: `Frame article body for report ${index + 1} presenting a specific viewpoint on the matter.`,
                    headline: `${report.categories.primary().toString()} Angle: ${index + 1}`,
                    stance: 'NEUTRAL',
                },
            ],
            headline: `Composed Article ${index + 1}`,
        }));

        // Default mock responses
        mockReportRepository.findReportsWithoutArticles.mockResolvedValue(testReports);
        mockArticleCompositionAgent.run.mockImplementation(async () => mockCompositionResults[0]);
        mockArticleRepository.createMany.mockResolvedValue();

        // Mock fake article agent to return null by default for predictable testing
        mockArticleFalsificationAgent.run.mockResolvedValue(null);

        // Mock findMany to return empty array by default (no existing articles)
        mockArticleRepository.findMany.mockResolvedValue([]);
    });

    describe('execute', () => {
        test('should compose articles successfully for reports without articles', async () => {
            // Given - valid country and language parameters
            const country = DEFAULT_COUNTRY;
            const language = DEFAULT_LANGUAGE;

            // When - executing the use case
            const result = await useCase.execute(language, country);

            // Then - it should find reports without articles
            expect(mockReportRepository.findReportsWithoutArticles).toHaveBeenCalledWith({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20,
            });

            // And compose articles for each report through the agent
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_REPORTS_COUNT);
            testReports.forEach((report) => {
                expect(mockArticleCompositionAgent.run).toHaveBeenCalledWith({
                    report: report,
                    targetCountry: country,
                    targetLanguage: language,
                });
            });

            // And save articles (at least once for real articles, possibly more for fake ones)
            expect(mockArticleRepository.createMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        categories: expect.any(Categories),
                        country: expect.any(Country),
                        reportIds: expect.arrayContaining([expect.any(String)]),
                    }),
                ]),
            );

            // And return the composed articles (at least the real ones)
            expect(result.length).toBeGreaterThanOrEqual(TEST_REPORTS_COUNT);

            // Should have at least the real articles from reports
            const realArticles = result.filter((article) => !article.isFabricated());
            expect(realArticles).toHaveLength(TEST_REPORTS_COUNT);

            // All real articles should be neutral/factual
            realArticles.forEach((article) => {
                expect(article.isFabricated()).toBe(false);
            });
        });

        test('should handle empty reports result gracefully', async () => {
            // Given - no reports without articles
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([]);

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should return empty array without calling composition agent
            expect(mockArticleCompositionAgent.run).not.toHaveBeenCalled();
            expect(mockArticleRepository.createMany).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        test('should handle null response from article composer agent', async () => {
            // Given - agent returns null for some reports
            mockArticleCompositionAgent.run.mockImplementation(async (params) => {
                // Return null for first report, valid result for others
                return params?.report === testReports[0] ? null : mockCompositionResults[0];
            });

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should skip null results and process valid ones
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_REPORTS_COUNT);

            // Should have at least the successful real articles
            const realArticles = result.filter((article) => !article.isFabricated());
            expect(realArticles).toHaveLength(TEST_REPORTS_COUNT - 1);
        });

        test('should continue processing if individual article composition fails', async () => {
            // Given - agent throws error for one report
            mockArticleCompositionAgent.run.mockImplementation(async (params) => {
                if (params?.report === testReports[1]) {
                    throw new Error('Agent composition failed');
                }
                return mockCompositionResults[0];
            });

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should continue processing other reports
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_REPORTS_COUNT);

            // Should have the successful real articles
            const realArticles = result.filter((article) => !article.isFabricated());
            expect(realArticles).toHaveLength(TEST_REPORTS_COUNT - 1);
        });

        test('should handle different countries and languages', async () => {
            // Given - different country and language
            const country = new Country('FR');
            const language = new Language('FR');

            // When - executing the use case
            await useCase.execute(language, country);

            // Then - it should pass correct parameters to report repository
            expect(mockReportRepository.findReportsWithoutArticles).toHaveBeenCalledWith({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20,
            });

            // And pass correct parameters to article composer
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetCountry: country,
                    targetLanguage: language,
                }),
            );
        });

        test('should throw error when report repository fails', async () => {
            // Given - report repository throws error
            const repositoryError = new Error('Report repository failed');
            mockReportRepository.findReportsWithoutArticles.mockRejectedValue(repositoryError);

            // When - executing the use case
            // Then - it should throw the error
            await expect(useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY)).rejects.toThrow(
                'Report repository failed',
            );

            expect(mockArticleCompositionAgent.run).not.toHaveBeenCalled();
            expect(mockArticleRepository.createMany).not.toHaveBeenCalled();
        });

        test('should continue processing when article repository fails', async () => {
            // Given - article repository throws error on create
            mockArticleRepository.createMany.mockRejectedValue(
                new Error('Article repository failed'),
            );

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should continue processing but return fewer articles due to failures
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_REPORTS_COUNT);
            expect(mockArticleRepository.createMany).toHaveBeenCalled();
            // Result might be empty due to repository failures, but processing should continue
            expect(result).toEqual(expect.any(Array));
        });

        test('should create articles with correct report relationships', async () => {
            // Given - valid reports and composition results
            const testReport = testReports[0];
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([testReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should have at least one real article with report relationship
            const realArticles = result.filter((article) => !article.isFabricated());
            expect(realArticles).toHaveLength(1);
            expect(realArticles[0].reportIds).toEqual([testReport.id]);
            expect(realArticles[0].publishedAt).toEqual(testReport.dateline);
            expect(realArticles[0].categories).toEqual(testReport.categories);
            // And article should be neutral/factual
            expect(realArticles[0].isFabricated()).toBe(false);
        });

        test('should generate fake articles when no fake articles in recent ones', async () => {
            // Given - valid reports and no fake articles in recent ones
            const testReport = testReports[0];
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([testReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // Mock existing articles with no fake ones (all real)
            const existingRealArticles = Array.from(
                { length: 10 },
                (_, i) =>
                    new Article({
                        authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                        // Real articles only
                        body: new Body(
                            `This is existing real article body content number ${i + 1} with sufficient length for validation`,
                        ),
                        categories: new Categories(['TECHNOLOGY']),
                        country: DEFAULT_COUNTRY,
                        headline: new Headline(`Existing Real Article ${i + 1}`),
                        id: randomUUID(),
                        language: DEFAULT_LANGUAGE,
                        publishedAt: new Date(Date.now() - i * 1000 * 60 * 60),
                        traits: new ArticleTraits(),
                    }),
            );

            mockArticleRepository.findMany.mockResolvedValue(existingRealArticles);

            // Mock fake article generation to succeed
            mockArticleFalsificationAgent.run.mockResolvedValue({
                body: 'In a shocking turn of events that has left residents bewildered, a domestic cat named Whiskers has been elected mayor of the fictional town of Nowheresville.',
                categories: new Categories(['POLITICS']),
                clarification:
                    'This article is fabricated as part of a fake-news detection game. Cats cannot run for public office, making the premise impossible.',
                headline: 'House Cat Elected Mayor in Landslide Victory',
                insertAfterIndex: 0,
                tone: 'satirical',
            });

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should generate both real and fake articles
            expect(result.length).toBeGreaterThan(1);

            // Should have one real article (from report)
            const realArticles = result.filter((article) => !article.isFabricated());
            expect(realArticles).toHaveLength(1);
            expect(realArticles[0].reportIds).toEqual([testReport.id]);

            // Should have 1-2 fake articles (since no fake in recent)
            const fakeArticles = result.filter((article) => article.isFabricated());
            expect(fakeArticles.length).toBeGreaterThanOrEqual(1);
            expect(fakeArticles.length).toBeLessThanOrEqual(3);

            // Should have checked recent articles
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith({
                country: DEFAULT_COUNTRY,
                language: DEFAULT_LANGUAGE,
                limit: 10,
            });

            // Should have called falsification agent with context from recent articles
            expect(mockArticleFalsificationAgent.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({
                        currentDate: expect.any(Date),
                        recentArticles: expect.arrayContaining([
                            expect.objectContaining({
                                body: expect.stringContaining(
                                    'This is existing real article body content',
                                ),
                                headline: expect.stringContaining('Existing Real Article'),
                            }),
                        ]),
                    }),
                    targetCountry: DEFAULT_COUNTRY,
                    targetLanguage: DEFAULT_LANGUAGE,
                    // targetCategory should not be provided - AI chooses based on context
                }),
            );
        });

        test('should skip fake article generation when fake article exists in recent ones', async () => {
            // Given - valid reports but fake article exists in recent ones
            const testReport = testReports[0];
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([testReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // Mock existing articles with one fake article
            const existingArticles = [
                new Article({
                    authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                    body: new Body(
                        'This is existing real article body content with sufficient length for validation',
                    ),
                    categories: new Categories(['TECHNOLOGY']),
                    country: DEFAULT_COUNTRY,
                    headline: new Headline('Existing Real Article'),
                    id: randomUUID(),
                    language: DEFAULT_LANGUAGE,
                    publishedAt: new Date(Date.now() - 1000 * 60 * 60),
                    traits: new ArticleTraits(),
                }),
                new Article({
                    authenticity: new Authenticity(
                        AuthenticityStatusEnum.FABRICATED,
                        'Fabricated for testing',
                    ),
                    body: new Body(
                        'This is existing fake article body content with sufficient length for validation',
                    ),
                    categories: new Categories(['POLITICS']),
                    country: DEFAULT_COUNTRY,
                    headline: new Headline('Existing Fake Article'),
                    id: randomUUID(),
                    language: DEFAULT_LANGUAGE,
                    publishedAt: new Date(Date.now() - 2000 * 60 * 60),
                    traits: new ArticleTraits(),
                }),
            ];

            mockArticleRepository.findMany.mockResolvedValue(existingArticles);

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should generate only real articles (no fake due to recent fake found)
            expect(result).toHaveLength(1);
            expect(result[0].isFabricated()).toBe(false);
            expect(result[0].reportIds).toEqual([testReport.id]);

            // Should have checked recent articles
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith({
                country: DEFAULT_COUNTRY,
                language: DEFAULT_LANGUAGE,
                limit: 10,
            });

            // Should not have called faker agent due to recent fake found
            expect(mockArticleFalsificationAgent.run).not.toHaveBeenCalled();
        });

        test('should handle fake article generation failures gracefully', async () => {
            // Given - valid reports but fake article generation fails
            const testReport = testReports[0];
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([testReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // Mock existing articles with no fake ones
            const existingRealArticles = Array.from(
                { length: 5 },
                (_, i) =>
                    new Article({
                        authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                        body: new Body(
                            `This is existing real article body content number ${i + 1} with sufficient length for validation`,
                        ),
                        categories: new Categories(['TECHNOLOGY']),
                        country: DEFAULT_COUNTRY,
                        headline: new Headline(`Existing Real Article ${i + 1}`),
                        id: randomUUID(),
                        language: DEFAULT_LANGUAGE,
                        publishedAt: new Date(Date.now() - i * 1000 * 60 * 60),
                        traits: new ArticleTraits(),
                    }),
            );

            mockArticleRepository.findMany.mockResolvedValue(existingRealArticles);

            // Mock fake article generation to fail
            mockArticleFalsificationAgent.run.mockRejectedValue(
                new Error('Fake article generation failed'),
            );

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should still generate real articles successfully
            expect(result).toHaveLength(1);
            expect(result[0].isFabricated()).toBe(false);
            expect(result[0].reportIds).toEqual([testReport.id]);

            // Should have called falsification agent with context from recent articles
            expect(mockArticleFalsificationAgent.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({
                        currentDate: expect.any(Date),
                        recentArticles: expect.arrayContaining([
                            expect.objectContaining({
                                body: expect.stringContaining(
                                    'This is existing real article body content',
                                ),
                                headline: expect.stringContaining('Existing Real Article'),
                            }),
                        ]),
                    }),
                    targetCountry: DEFAULT_COUNTRY,
                    targetLanguage: DEFAULT_LANGUAGE,
                    // targetCategory should not be provided - AI chooses based on context
                }),
            );

            // Should have logged the error but continued processing
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Error generating fake article',
                expect.objectContaining({
                    country: DEFAULT_COUNTRY.toString(),
                    error: expect.any(Error),
                    language: DEFAULT_LANGUAGE.toString(),
                }),
            );
        });

        test('should handle repository failure gracefully', async () => {
            // Given - valid reports but article repository findMany fails
            const testReport = testReports[0];
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([testReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // Mock article repository to fail on findMany
            mockArticleRepository.findMany.mockRejectedValue(new Error('Repository failed'));

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should still generate real articles successfully
            expect(result).toHaveLength(1);
            expect(result[0].isFabricated()).toBe(false);
            expect(result[0].reportIds).toEqual([testReport.id]);

            // Should have logged the error
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Error checking fake article requirements',
                expect.objectContaining({
                    country: DEFAULT_COUNTRY.toString(),
                    error: expect.any(Error),
                    language: DEFAULT_LANGUAGE.toString(),
                }),
            );

            // Should not have called faker agent due to repository failure
            expect(mockArticleFalsificationAgent.run).not.toHaveBeenCalled();
        });
    });
});
