import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Article } from '../../../../domain/entities/article.entity.js';
import { Report } from '../../../../domain/entities/report.entity.js';
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
import { Classification } from '../../../../domain/value-objects/report/classification.vo.js';
import { ClassificationState } from '../../../../domain/value-objects/report/classification-state.vo.js';
import { DeduplicationState } from '../../../../domain/value-objects/report/deduplication-state.vo.js';

import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionResult,
} from '../../../ports/outbound/agents/article-composition.agent.js';
import {
    type ArticleFabricationAgentPort,
    type ArticleFabricationResult,
} from '../../../ports/outbound/agents/article-fabrication.agent.js';
import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article-repository.port.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report-repository.port.js';

import { PublishReportsUseCase } from '../publish-reports.use-case.js';

describe('PublishReportsUseCase', () => {
    let useCase: PublishReportsUseCase;
    let mockArticleCompositionAgent: DeepMockProxy<ArticleCompositionAgentPort>;
    let mockArticleFabricationAgent: DeepMockProxy<ArticleFabricationAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;

    const createEmptyReport = (id: string): Report =>
        new Report({
            angles: [],
            categories: new Categories(['WORLD']),
            classification: new Classification('GENERAL'),
            classificationState: new ClassificationState('COMPLETE'),
            country: new Country('US'),
            createdAt: new Date('2023-01-01'),
            dateline: new Date('2023-01-01'),
            deduplicationState: new DeduplicationState('COMPLETE'),
            facts: 'Test facts',
            id: randomUUID(),
            sourceReferences: [],
            traits: new ArticleTraits(),
            updatedAt: new Date('2023-01-01'),
        });

    beforeEach(() => {
        mockArticleCompositionAgent = mock<ArticleCompositionAgentPort>();
        mockArticleFabricationAgent = mock<ArticleFabricationAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockReportRepository = mock<ReportRepositoryPort>();
        mockArticleRepository = mock<ArticleRepositoryPort>();

        useCase = new PublishReportsUseCase(
            mockArticleCompositionAgent,
            mockArticleFabricationAgent,
            mockLogger,
            mockReportRepository,
            mockArticleRepository,
        );
    });

    describe('execute', () => {
        const testLanguage = new Language('EN');
        const testCountry = new Country('US');

        test('should publish articles from reports successfully', async () => {
            // Given
            const mockReport = createEmptyReport('test-report-id');

            const mockCompositionResult: ArticleCompositionResult = {
                body: 'Test body content',
                frames: [
                    {
                        body: 'Frame body',
                        headline: 'Frame headline',
                    },
                ],
                headline: 'Test headline',
            };

            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([mockReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResult);
            mockArticleRepository.createMany.mockResolvedValue();
            mockArticleRepository.countMany.mockResolvedValue(5); // Less than 10, so no fake articles

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(Article);
            expect(result[0].headline.value).toBe('Test headline');
            expect(result[0].body.value).toBe('Test body content');
            expect(result[0].authenticity.status).toBe(AuthenticityStatusEnum.AUTHENTIC);
            expect(result[0].frames).toHaveLength(1);

            expect(mockReportRepository.findReportsWithoutArticles).toHaveBeenCalledWith({
                classification: ['GENERAL', 'NICHE'],
                country: 'US',
                limit: 20,
            });

            expect(mockArticleCompositionAgent.run).toHaveBeenCalledWith({
                report: mockReport,
                targetCountry: testCountry,
                targetLanguage: testLanguage,
            });

            expect(mockArticleRepository.createMany).toHaveBeenCalledWith([expect.any(Article)]);
        });

        test('should generate fake articles when conditions are met', async () => {
            // Given
            const existingArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Existing headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            const mockFabricationResult: ArticleFabricationResult = {
                body: 'Fake body content',
                categories: new Categories(['WORLD']),
                clarification: 'This is fake',
                headline: 'Fake headline',
                insertAfterIndex: 0,
                tone: 'satirical',
            };

            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([]);
            mockArticleRepository.countMany.mockResolvedValue(15); // Above threshold
            mockArticleRepository.findMany.mockResolvedValue([existingArticle]);
            mockArticleFabricationAgent.run.mockResolvedValue(mockFabricationResult);
            mockArticleRepository.createMany.mockResolvedValue();

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(result[0].authenticity.status).toBe(AuthenticityStatusEnum.FABRICATED);
            expect(result[0].headline.value).toBe('Fake headline');

            expect(mockArticleFabricationAgent.run).toHaveBeenCalledWith({
                context: {
                    currentDate: expect.any(Date),
                    recentArticles: [
                        {
                            body: 'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                            frames: [],
                            headline: 'Existing headline',
                            publishedAt: expect.any(String),
                        },
                    ],
                },
                targetCountry: testCountry,
                targetLanguage: testLanguage,
            });
        });

        test('should handle empty reports gracefully', async () => {
            // Given
            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([]);
            mockArticleRepository.countMany.mockResolvedValue(5); // Below threshold for fakes

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.info).toHaveBeenCalledWith('No reports found for publishing', {
                country: 'US',
                language: 'EN',
            });
        });

        test('should continue processing when composition agent fails', async () => {
            // Given
            const mockReport = createEmptyReport('test-report-id');

            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([mockReport]);
            mockArticleCompositionAgent.run.mockResolvedValue(null);
            mockArticleRepository.countMany.mockResolvedValue(5);

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('Composition agent returned no result', {
                country: 'US',
                language: 'EN',
                reportId: 'test-report-id',
            });
        });
    });
});
