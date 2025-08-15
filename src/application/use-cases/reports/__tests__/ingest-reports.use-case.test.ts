import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

// Domain
import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';
import { AngleNarrative } from '../../../../domain/value-objects/report-angle/angle-narrative.vo.js';
import { ReportAngle } from '../../../../domain/value-objects/report-angle/report-angle.vo.js';
import { Background } from '../../../../domain/value-objects/report/background.vo.js';
import { Core } from '../../../../domain/value-objects/report/core.vo.js';
import { DeduplicationState } from '../../../../domain/value-objects/report/deduplication-state.vo.js';
import { ClassificationState } from '../../../../domain/value-objects/report/tier-state.vo.js';

// Ports
import {
    type ReportIngestionAgentPort,
    type ReportIngestionResult,
} from '../../../ports/outbound/agents/report-ingestion.agent.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report-repository.port.js';
import {
    type NewsProviderPort,
    type NewsReport,
} from '../../../ports/outbound/providers/news.port.js';

import { IngestReportsUseCase } from '../ingest-reports.use-case.js';

describe('IngestReportsUseCase', () => {
    const createEmptyReport = (_id: string): Report =>
        new Report({
            angles: [
                new ReportAngle({
                    narrative: new AngleNarrative(
                        'This is a very long and detailed narrative for the mock angle, created specifically for testing. It needs to be over 200 characters long to pass the validation rules of the value object. This ensures that when our use case tests run, they do not fail due to simple validation errors in the mock data construction process, allowing us to focus on the actual logic of the use case itself.',
                    ),
                }),
            ],
            background: new Background(
                'This is background context for testing purposes that provides necessary contextual information.',
            ),
            categories: new Categories(['TECHNOLOGY']),
            classificationState: new ClassificationState('PENDING'),
            core: new Core(
                'This is the core story for testing purposes that represents the main narrative being reported.',
            ),
            country: new Country('us'),
            createdAt: new Date(),
            dateline: new Date(),
            deduplicationState: new DeduplicationState('PENDING'),
            id: '11111111-1111-4111-8111-111111111111',
            sourceReferences: [],
            tier: undefined,
            traits: new ArticleTraits(),
            updatedAt: new Date(),
        });
    // Test Constants
    const DEFAULT_COUNTRY = new Country('us');
    const DEFAULT_LANGUAGE = new Language('en');
    const MOCK_NEWS_STORIES: NewsReport[] = [
        {
            articles: [
                { body: 'B1', headline: 'H1', id: 'a1' },
                { body: 'B2', headline: 'H2', id: 'a2' },
            ],
            publishedAt: new Date(),
        },
        {
            articles: [
                { body: 'B3', headline: 'H3', id: 'b1' },
                { body: 'B4', headline: 'H4', id: 'b2' },
            ],
            publishedAt: new Date(),
        },
    ];

    // Mocks
    let mockReportIngestionAgent: DeepMockProxy<ReportIngestionAgentPort>;

    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockNewsProvider: DeepMockProxy<NewsProviderPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let useCase: IngestReportsUseCase;

    beforeEach(() => {
        mockReportIngestionAgent = mock<ReportIngestionAgentPort>();

        mockLogger = mock<LoggerPort>();
        mockNewsProvider = mock<NewsProviderPort>();
        mockReportRepository = mock<ReportRepositoryPort>();

        useCase = new IngestReportsUseCase(
            mockReportIngestionAgent,
            mockLogger,
            mockNewsProvider,
            mockReportRepository,
        );

        // Setup common mocks
        const mockResult: ReportIngestionResult = {
            angles: [
                {
                    narrative:
                        'This is a comprehensive angle narrative that contains detailed information about the mainstream angle on this topic. It includes various viewpoints, supporting evidence, and contextual information that would be sufficient for creating a proper report angle. This needs to be long enough to pass any validation requirements.',
                },
            ],
            background:
                'This is background context that provides supporting information to help understand the core story. It includes relevant history, key players, and contextual details.',
            categories: new Categories(['TECHNOLOGY']),
            core: 'This is the core story that represents the main narrative being reported. It contains the primary information about what happened or what the story is fundamentally about.',
        };

        mockReportIngestionAgent.run.mockResolvedValue(mockResult);
        mockReportRepository.create.mockImplementation(async (report) => report);

        // Default happy path mocks
        mockNewsProvider.fetchNews.mockResolvedValue(MOCK_NEWS_STORIES);

        mockReportRepository.getAllSourceReferences.mockResolvedValue([]);
    });

    test('it should create new reports for unique, valid news items', async () => {
        // Given: The news provider returns two new, unique reports.

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should create a new report for each of them.
        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(2);
        expect(mockReportRepository.create).toHaveBeenCalledTimes(2);
        expect(mockReportRepository.addSourceReferences).not.toHaveBeenCalled();
    });

    test('it sets deduplicationState to PENDING for created reports', async () => {
        // When
        const reports = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then
        expect(reports.length).toBeGreaterThan(0);
        for (const report of reports) {
            expect(report.deduplicationState.isPending()).toBe(true);
        }
    });

    test('it should ignore news reports that have already been processed by source ID', async () => {
        // Given: One of the news reports contains an article ID that is already in our database.
        mockReportRepository.getAllSourceReferences.mockResolvedValue(['b1']);

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should only process the one truly new report.

        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(1);
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should ignore news reports with insufficient source articles to analyze', async () => {
        // Given: One of the news reports has only one article, which is below our quality threshold.
        mockNewsProvider.fetchNews.mockResolvedValue([
            { articles: [{ body: 'BC1', headline: 'HC1', id: 'c1' }], publishedAt: new Date() }, // Insufficient
            MOCK_NEWS_STORIES[1], // Sufficient
        ]);

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should only process the one valid report.
        // Dedup agent is skipped because only one valid report, list empty

        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(1);
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should gracefully handle a failure from the ingestion agent', async () => {
        // Given: The ingestion agent fails for one of the reports.
        const mockResult: ReportIngestionResult = {
            angles: [
                {
                    narrative:
                        'This is a comprehensive angle narrative that contains detailed information about the mainstream angle on this topic. It includes various viewpoints, supporting evidence, and contextual information that would be sufficient for creating a proper report angle. This needs to be long enough to pass any validation requirements.',
                },
            ],
            background:
                'This is background context that provides supporting information to help understand the core story. It includes relevant history, key players, and contextual details.',
            categories: new Categories(['TECHNOLOGY']),
            core: 'This is the core story that represents the main narrative being reported. It contains the primary information about what happened or what the story is fundamentally about.',
        };

        mockReportIngestionAgent.run.mockResolvedValueOnce(mockResult).mockResolvedValueOnce(null); // Second report fails to ingest

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should still successfully create the first report.
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should skip deduplication when there are no existing reports', async () => {
        // Given – repository returns no recent reports so dedup list will be empty

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then – deduplication agent is invoked once for second report

        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(2);
    });

    test('it should only process reports that meet the 70% article threshold or have more than 3 articles', async () => {
        // Given: Four news reports with varying article counts (10, 6, 3, and 2).
        const newsReports: NewsReport[] = [
            {
                articles: Array.from({ length: 10 }, (_, i) => ({
                    body: `B${i}`,
                    headline: `H${i}`,
                    id: `id${i}`,
                })),
                publishedAt: new Date(),
            },
            {
                articles: Array.from({ length: 6 }, (_, i) => ({
                    body: `B${i}`,
                    headline: `H${i}`,
                    id: `id6${i}`,
                })),
                publishedAt: new Date(),
            },
            {
                articles: Array.from({ length: 3 }, (_, i) => ({
                    body: `B${i}`,
                    headline: `H${i}`,
                    id: `id3${i}`,
                })),
                publishedAt: new Date(),
            },
            {
                articles: Array.from({ length: 2 }, (_, i) => ({
                    body: `B${i}`,
                    headline: `H${i}`,
                    id: `id2${i}`,
                })),
                publishedAt: new Date(),
            },
        ];

        // Override default mock
        mockNewsProvider.fetchNews.mockResolvedValue(newsReports);
        mockReportRepository.getAllSourceReferences.mockResolvedValue([]); // No duplicates

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: Only the 10- and 6-article reports should be processed.
        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(2);
        expect(mockReportRepository.create).toHaveBeenCalledTimes(2);
        // Verify the IDs processed correspond to the 10- and 6-article reports
        const processedArticleCounts = mockReportIngestionAgent.run.mock.calls.map(
            ([{ newsReport }]) => newsReport.articles.length,
        );
        expect(processedArticleCounts).toEqual([10, 6]);
    });

    test('it should process a report that passes article threshold even if the largest report is filtered out as duplicate', async () => {
        // Given: Two reports – 10-article (duplicate) and 6-article (unique).
        const duplicateReportArticles = Array.from({ length: 10 }, (_, i) => ({
            body: `DB${i}`,
            headline: `DH${i}`,
            id: `dup${i}`,
        }));
        const uniqueReportArticles = Array.from({ length: 6 }, (_, i) => ({
            body: `UB${i}`,
            headline: `UH${i}`,
            id: `uniq${i}`,
        }));

        const newsReports: NewsReport[] = [
            { articles: duplicateReportArticles, publishedAt: new Date() },
            { articles: uniqueReportArticles, publishedAt: new Date() },
        ];

        // Mock: all articles of first report already exist in DB
        mockNewsProvider.fetchNews.mockResolvedValue(newsReports);
        mockReportRepository.getAllSourceReferences.mockResolvedValue(
            duplicateReportArticles.map((a) => a.id),
        );

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: The 6-article report should still be processed (as it meets 70% of 10).
        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(1);
        const processedArticleCount =
            mockReportIngestionAgent.run.mock.calls[0][0].newsReport.articles.length;
        expect(processedArticleCount).toBe(6);
    });

    test('it sets deduplicationState to PENDING for created reports', async () => {
        // When
        const reports = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then
        expect(reports.length).toBeGreaterThan(0);
        for (const report of reports) {
            expect(report.deduplicationState.isPending()).toBe(true);
        }
    });

    test('it sets deduplicationState to PENDING for all ingested reports', async () => {
        // When
        const reports = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then – all returned reports should have deduplication pending
        expect(reports.length).toBeGreaterThan(0);
        for (const report of reports) {
            expect(report.deduplicationState.isPending()).toBe(true);
        }
    });
});
