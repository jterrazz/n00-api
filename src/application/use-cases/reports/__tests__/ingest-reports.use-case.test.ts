import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import { type ReportDeduplicationAgentPort } from '../../../ports/outbound/agents/report-deduplication.agent.js';
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
    let mockReportDeduplicationAgent: DeepMockProxy<ReportDeduplicationAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockNewsProvider: DeepMockProxy<NewsProviderPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let useCase: IngestReportsUseCase;

    beforeEach(() => {
        mockReportIngestionAgent = mock<ReportIngestionAgentPort>();
        mockReportDeduplicationAgent = mock<ReportDeduplicationAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockNewsProvider = mock<NewsProviderPort>();
        mockReportRepository = mock<ReportRepositoryPort>();

        useCase = new IngestReportsUseCase(
            mockReportIngestionAgent,
            mockReportDeduplicationAgent,
            mockLogger,
            mockNewsProvider,
            mockReportRepository,
        );

        // Setup common mocks
        const mockResult: ReportIngestionResult = {
            angles: [
                {
                    corpus: 'This is a comprehensive angle corpus that contains detailed information about the mainstream angle on this topic. It includes various viewpoints, supporting evidence, and contextual information that would be sufficient for creating a proper report angle. This needs to be long enough to pass any validation requirements.',
                    discourse: 'MAINSTREAM',
                    stance: 'NEUTRAL',
                },
            ],
            category: new Category('technology'),
            facts: 'These are comprehensive facts about the report that contain detailed information about the event, including who, what, when, where, and how. The facts are written in a neutral tone and provide sufficient context for understanding the report completely without bias or interpretation.',
        };

        mockReportDeduplicationAgent.run.mockResolvedValue({
            duplicateOfReportId: null,
        });
        mockReportIngestionAgent.run.mockResolvedValue(mockResult);
        mockReportRepository.create.mockImplementation(async (report) => report);

        // Default happy path mocks
        mockNewsProvider.fetchNews.mockResolvedValue(MOCK_NEWS_STORIES);
        mockReportRepository.findRecentFacts.mockResolvedValue([]);
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

    test('it should merge sources when a semantically duplicate report is found', async () => {
        // Given: The deduplication agent identifies the second report as a duplicate of an existing one.
        const existingReportId = 'existing-report-id';
        mockReportDeduplicationAgent.run
            .mockResolvedValueOnce({ duplicateOfReportId: null })
            .mockResolvedValueOnce({
                duplicateOfReportId: existingReportId,
            });

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should create one new report and merge the sources for the duplicate.
        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(1); // Only called for the first, unique report
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
        expect(mockReportRepository.addSourceReferences).toHaveBeenCalledTimes(1);
        expect(mockReportRepository.addSourceReferences).toHaveBeenCalledWith(existingReportId, [
            'b1',
            'b2',
        ]);
    });

    test('it should ignore news reports that have already been processed by source ID', async () => {
        // Given: One of the news reports contains an article ID that is already in our database.
        mockReportRepository.getAllSourceReferences.mockResolvedValue(['b1']);

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should only process the one truly new report.
        expect(mockReportDeduplicationAgent.run).toHaveBeenCalledTimes(1);
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
        expect(mockReportDeduplicationAgent.run).toHaveBeenCalledTimes(1);
        expect(mockReportIngestionAgent.run).toHaveBeenCalledTimes(1);
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should gracefully handle a failure from the ingestion agent', async () => {
        // Given: The ingestion agent fails for one of the reports.
        const mockResult: ReportIngestionResult = {
            angles: [
                {
                    corpus: 'This is a comprehensive angle corpus that contains detailed information about the mainstream angle on this topic. It includes various viewpoints, supporting evidence, and contextual information that would be sufficient for creating a proper report angle. This needs to be long enough to pass any validation requirements.',
                    discourse: 'MAINSTREAM',
                    stance: 'NEUTRAL',
                },
            ],
            category: new Category('technology'),
            facts: 'These are comprehensive facts about the report that contain detailed information about the event, including who, what, when, where, and how. The facts are written in a neutral tone and provide sufficient context for understanding the report completely without bias or interpretation.',
        };

        mockReportIngestionAgent.run.mockResolvedValueOnce(mockResult).mockResolvedValueOnce(null); // Second report fails to ingest

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should still successfully create the first report.
        expect(mockReportRepository.create).toHaveBeenCalledTimes(1);
    });
});
