import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'node:crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

// Domain
import { Article } from '../../../../domain/entities/article.entity.js';
import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../../domain/value-objects/article/headline.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';
import { Background } from '../../../../domain/value-objects/report/background.vo.js';
import { Core } from '../../../../domain/value-objects/report/core.vo.js';
import { DeduplicationState } from '../../../../domain/value-objects/report/deduplication-state.vo.js';
import { ClassificationState } from '../../../../domain/value-objects/report/tier-state.vo.js';
import { Classification } from '../../../../domain/value-objects/report/tier.vo.js';

// Ports
import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionResult,
} from '../../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article/article-repository.port.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report/report-repository.port.js';

import { type FabricateArticlesUseCase } from '../../articles/fabricate-articles.use-case.js';
import { PublishReportsUseCase } from '../publish-reports.use-case.js';

describe('PublishReportsUseCase', () => {
    let useCase: PublishReportsUseCase;
    let mockArticleCompositionAgent: DeepMockProxy<ArticleCompositionAgentPort>;
    let mockFabricateArticlesUseCase: DeepMockProxy<FabricateArticlesUseCase>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;

    const createEmptyReport = (_id: string): Report =>
        new Report({
            angles: [],
            background: new Background(
                'Test background context that provides supporting information for understanding the story.',
            ),
            categories: new Categories(['WORLD']),
            classificationState: new ClassificationState('COMPLETE'),
            core: new Core(
                'Test core story that represents the main narrative being reported in this test case with comprehensive detail for validation purposes.',
            ),
            country: new Country('US'),
            createdAt: new Date('2023-01-01'),
            dateline: new Date('2023-01-01'),
            deduplicationState: new DeduplicationState('COMPLETE'),
            id: randomUUID(),
            sourceReferences: [],
            tier: new Classification('GENERAL'),
            traits: new ArticleTraits(),
            updatedAt: new Date('2023-01-01'),
        });

    beforeEach(() => {
        mockArticleCompositionAgent = mock<ArticleCompositionAgentPort>();
        mockFabricateArticlesUseCase = mock<FabricateArticlesUseCase>();
        mockLogger = mock<LoggerPort>();
        mockReportRepository = mock<ReportRepositoryPort>();
        mockArticleRepository = mock<ArticleRepositoryPort>();

        // Set up default mocks for all repository methods that might be called
        // Note: findReportsWithoutArticles is mocked in individual tests
        mockReportRepository.addSourceReferences.mockResolvedValue();
        mockReportRepository.create.mockResolvedValue({} as Report);
        mockReportRepository.createDuplicate.mockResolvedValue({} as Report);
        mockReportRepository.findById.mockResolvedValue(null);
        mockReportRepository.findMany.mockResolvedValue([]);
        mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([]);
        mockReportRepository.findRecentReports.mockResolvedValue([]);
        mockReportRepository.markAsDuplicate.mockResolvedValue({} as Report);
        mockReportRepository.findRecentFacts.mockResolvedValue([]);
        mockReportRepository.getAllSourceReferences.mockResolvedValue([]);
        mockReportRepository.update.mockResolvedValue({} as Report);

        mockArticleRepository.countMany.mockResolvedValue(0);
        mockArticleRepository.createMany.mockResolvedValue();
        mockArticleRepository.findMany.mockResolvedValue([]);
        mockArticleRepository.findManyByIds.mockResolvedValue([]);

        // Default mock for fabricate articles use case
        mockFabricateArticlesUseCase.execute.mockResolvedValue([]);

        // Properly mock the logger methods
        mockLogger.info.mockReturnValue();
        mockLogger.warn.mockReturnValue();
        mockLogger.error.mockReturnValue();
        mockLogger.debug.mockReturnValue();

        useCase = new PublishReportsUseCase(
            mockArticleCompositionAgent,
            mockFabricateArticlesUseCase,
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
                body: 'This is a test body content that has at least thirty characters to pass validation requirements',
                frames: [
                    {
                        body: 'This is a frame body that has at least thirty characters to pass validation requirements',
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
            expect(result[0].body.value).toBe(
                'This is a test body content that has at least thirty characters to pass validation requirements',
            );
            expect(result[0].authenticity.status).toBe(AuthenticityStatusEnum.AUTHENTIC);
            expect(result[0].frames).toHaveLength(1);

            expect(mockReportRepository.findReportsWithoutArticles).toHaveBeenCalledWith({
                country: 'US',
                limit: 20,
                tier: ['GENERAL', 'NICHE'],
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
            const fakeArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.FABRICATED, 'This is fake'),
                body: new Body(
                    'This is a fake body content that has at least thirty characters to pass validation requirements',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Fake headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            mockReportRepository.findReportsWithoutArticles.mockResolvedValue([]);
            mockFabricateArticlesUseCase.execute.mockResolvedValue([fakeArticle]);

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(result[0].authenticity.status).toBe(AuthenticityStatusEnum.FABRICATED);
            expect(result[0].headline.value).toBe('Fake headline');
            expect(result[0].body.value).toBe(
                'This is a fake body content that has at least thirty characters to pass validation requirements',
            );

            expect(mockFabricateArticlesUseCase.execute).toHaveBeenCalledWith(
                testLanguage,
                testCountry,
            );
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
                reportId: expect.any(String),
            });
        });
    });
});
