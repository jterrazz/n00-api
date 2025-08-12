import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Classification } from '../../../../domain/value-objects/report/classification.vo.js';
import { ClassificationState } from '../../../../domain/value-objects/report/classification-state.vo.js';
import { DeduplicationState } from '../../../../domain/value-objects/report/deduplication-state.vo.js';

import {
    type ReportDeduplicationAgentPort,
    type ReportDeduplicationResult,
} from '../../../ports/outbound/agents/report-deduplication.agent.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report-repository.port.js';

import { DeduplicateReportsUseCase } from '../deduplicate-reports.use-case.js';

describe('DeduplicateReportsUseCase', () => {
    let useCase: DeduplicateReportsUseCase;
    let mockReportDeduplicationAgent: DeepMockProxy<ReportDeduplicationAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;

    const createTestReport = (idPrefix: string, facts: string): Report =>
        new Report({
            angles: [],
            categories: new Categories(['WORLD']),
            classification: new Classification('GENERAL'),
            classificationState: new ClassificationState('COMPLETE'),
            country: new Country('US'),
            createdAt: new Date('2023-01-01'),
            dateline: new Date('2023-01-01'),
            deduplicationState: new DeduplicationState('PENDING'),
            facts,
            id: randomUUID(),
            sourceReferences: [],
            traits: new ArticleTraits(),
            updatedAt: new Date('2023-01-01'),
        });

    beforeEach(() => {
        mockReportDeduplicationAgent = mock<ReportDeduplicationAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockReportRepository = mock<ReportRepositoryPort>();

        useCase = new DeduplicateReportsUseCase(
            mockReportDeduplicationAgent,
            mockLogger,
            mockReportRepository,
        );
    });

    describe('execute', () => {
        const testCountry = new Country('US');

        test('should process pending reports and mark as unique when no duplicates found', async () => {
            // Given
            const pendingReport = createTestReport('pending1', 'Unique facts about event A');
            const existingReport = createTestReport('existing', 'Different facts about event B');

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([pendingReport]);
            mockReportRepository.findRecentReports.mockResolvedValue([existingReport]);
            mockReportDeduplicationAgent.run.mockResolvedValue({ duplicateOfReportId: null });
            mockReportRepository.update.mockResolvedValue({
                ...pendingReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(mockReportRepository.findReportsWithPendingDeduplication).toHaveBeenCalledWith({
                country: 'US',
                limit: 50,
            });
            expect(mockReportRepository.findRecentReports).toHaveBeenCalledWith({
                country: 'US',
                excludeIds: [pendingReport.id],
                limit: 1000,
                since: expect.any(Date),
            });
            expect(mockReportDeduplicationAgent.run).toHaveBeenCalledWith({
                existingReports: [existingReport],
                newReport: {
                    articles: [],
                    publishedAt: pendingReport.dateline,
                },
            });
            expect(mockReportRepository.update).toHaveBeenCalledWith(pendingReport.id, {
                deduplicationState: new DeduplicationState('COMPLETE'),
            });
        });

        test('should mark report as duplicate when duplicate is detected', async () => {
            // Given
            const pendingReport = createTestReport('pending1', 'Similar facts about event');
            const existingReport = createTestReport('existing', 'Similar facts about event');
            const duplicateResult: ReportDeduplicationResult = {
                duplicateOfReportId: existingReport.id,
            };

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([pendingReport]);
            mockReportRepository.findRecentReports.mockResolvedValue([existingReport]);
            mockReportDeduplicationAgent.run.mockResolvedValue(duplicateResult);
            mockReportRepository.markAsDuplicate.mockResolvedValue({
                ...pendingReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(mockReportRepository.markAsDuplicate).toHaveBeenCalledWith(pendingReport.id, {
                duplicateOfId: existingReport.id,
            });
            expect(mockLogger.info).toHaveBeenCalledWith('Report identified as duplicate', {
                duplicateOf: existingReport.id,
                reportId: pendingReport.id,
            });
        });

        test('should handle empty pending reports gracefully', async () => {
            // Given
            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([]);

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.info).toHaveBeenCalledWith('No reports pending deduplication', {
                country: 'US',
            });
            expect(mockReportRepository.findRecentReports).not.toHaveBeenCalled();
        });

        test('should process reports without country filter when no country provided', async () => {
            // Given
            const pendingReport = createTestReport('pending1', 'Test facts');

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([pendingReport]);
            mockReportRepository.findRecentReports.mockResolvedValue([]);
            mockReportRepository.update.mockResolvedValue({
                ...pendingReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute();

            // Then
            expect(result).toHaveLength(1);
            expect(mockReportRepository.findReportsWithPendingDeduplication).toHaveBeenCalledWith({
                country: undefined,
                limit: 50,
            });
            expect(mockLogger.info).toHaveBeenCalledWith('Starting report deduplication process', {
                country: 'all',
            });
        });

        test('should skip deduplication check when no existing reports available', async () => {
            // Given
            const pendingReport = createTestReport('pending1', 'Test facts');

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([pendingReport]);
            mockReportRepository.findRecentReports.mockResolvedValue([]);
            mockReportRepository.update.mockResolvedValue({
                ...pendingReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(mockReportDeduplicationAgent.run).not.toHaveBeenCalled();
            expect(mockReportRepository.update).toHaveBeenCalledWith(pendingReport.id, {
                deduplicationState: new DeduplicationState('COMPLETE'),
            });
        });

        test('should handle deduplication agent errors gracefully', async () => {
            // Given
            const pendingReport = createTestReport('pending1', 'Test facts');
            const existingReport = createTestReport('existing', 'Other facts');

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([pendingReport]);
            mockReportRepository.findRecentReports.mockResolvedValue([existingReport]);
            mockReportDeduplicationAgent.run.mockRejectedValue(new Error('Agent failed'));
            mockReportRepository.update.mockResolvedValue({
                ...pendingReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(mockLogger.warn).toHaveBeenCalledWith('Error processing report for deduplication', {
                error: expect.any(Error),
                reportId: pendingReport.id,
            });
            expect(mockReportRepository.update).toHaveBeenCalledWith(pendingReport.id, {
                deduplicationState: new DeduplicationState('COMPLETE'),
            });
        });

        test('should log summary statistics correctly', async () => {
            // Given
            const uniqueReport = createTestReport('unique1', 'Unique facts');
            const duplicateReport = createTestReport('duplicate1', 'Duplicate facts');
            const existingReport = createTestReport('existing', 'Existing facts');

            mockReportRepository.findReportsWithPendingDeduplication.mockResolvedValue([
                uniqueReport,
                duplicateReport,
            ]);
            mockReportRepository.findRecentReports.mockResolvedValue([existingReport]);

            // Mock first call (unique) and second call (duplicate)
            mockReportDeduplicationAgent.run
                .mockResolvedValueOnce({ duplicateOfReportId: null })
                .mockResolvedValueOnce({ duplicateOfReportId: existingReport.id });

            mockReportRepository.update.mockResolvedValue({
                ...uniqueReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });
            mockReportRepository.markAsDuplicate.mockResolvedValue({
                ...duplicateReport,
                deduplicationState: new DeduplicationState('COMPLETE'),
            });

            // When
            const result = await useCase.execute(testCountry);

            // Then
            expect(result).toHaveLength(2);
            expect(mockLogger.info).toHaveBeenCalledWith('Report deduplication process completed', {
                country: 'US',
                duplicatesFound: 1,
                processedCount: 2,
                uniqueReports: 1,
            });
        });
    });
});
