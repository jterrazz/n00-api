import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Classification } from '../../../../domain/value-objects/report/classification.vo.js';
import { AngleCorpus } from '../../../../domain/value-objects/report-angle/angle-corpus.vo.js';
import { ReportAngle } from '../../../../domain/value-objects/report-angle/report-angle.vo.js';

import {
    type ReportClassificationAgentPort,
    type ReportClassificationResult,
} from '../../../ports/outbound/agents/report-classification.agent.js';
import { type ReportRepositoryPort } from '../../../ports/outbound/persistence/report-repository.port.js';

import { ClassifyReportsUseCase } from '../classify-reports.use-case.js';

const createMockReport = (
    id: string,
    tier: 'GENERAL' | 'NICHE' | 'PENDING' = 'PENDING',
): Report => {
    const reportId = id;
    return new Report({
        angles: [
            new ReportAngle({
                angleCorpus: new AngleCorpus(
                    'This is a very long and detailed holistic digest for the mock angle, created specifically for testing. It needs to be over 200 characters long to pass the validation rules of the value object. This ensures that when our use case tests run, they do not fail due to simple validation errors in the mock data construction process, allowing us to focus on the actual logic of the use case itself.',
                ),
            }),
        ],
        categories: new Categories(['TECHNOLOGY']),
        classification: new Classification(tier),
        country: new Country('us'),
        createdAt: new Date(),
        dateline: new Date(),
        facts: 'These are valid report facts that are definitely long enough for testing purposes. They detail the event and provide context that should be sufficient for any validation checks that might be in place, ensuring that this mock object is robust.',
        id: reportId,
        sourceReferences: ['source-1'],
        traits: new ArticleTraits(),
        updatedAt: new Date(),
    });
};

describe('ClassifyReportsUseCase', () => {
    let mockReportClassificationAgent: DeepMockProxy<ReportClassificationAgentPort>;
    let mockReportRepository: DeepMockProxy<ReportRepositoryPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let useCase: ClassifyReportsUseCase;

    // Test data
    let reportToReview: Report;

    beforeEach(() => {
        reportToReview = createMockReport(randomUUID());

        mockReportClassificationAgent = mock<ReportClassificationAgentPort>();
        mockReportRepository = mock<ReportRepositoryPort>();
        mockLogger = mock<LoggerPort>();

        useCase = new ClassifyReportsUseCase(
            mockReportClassificationAgent,
            mockLogger,
            mockReportRepository,
        );

        // Default mock implementations
        mockReportRepository.findMany.mockResolvedValue([reportToReview]);
        mockReportRepository.update.mockResolvedValue(reportToReview);
    });

    describe('execute', () => {
        test('should classify reports pending review and update their status', async () => {
            // Given
            const classificationResult: ReportClassificationResult = {
                classification: new Classification('GENERAL'),
                reason: 'A solid, well-written report with broad appeal.',
                traits: new ArticleTraits({ smart: true, uplifting: false }),
            };
            mockReportClassificationAgent.run.mockResolvedValue(classificationResult);

            // When
            await useCase.execute();

            // Then
            expect(mockReportRepository.findMany).toHaveBeenCalledWith({
                limit: 50,
                where: { classification: 'PENDING' },
            });
            expect(mockReportClassificationAgent.run).toHaveBeenCalledWith({
                report: reportToReview,
            });
            expect(mockReportRepository.update).toHaveBeenCalledWith(reportToReview.id, {
                classification: expect.any(Object),
                traits: expect.any(Object),
            });
            expect(mockLogger.info).toHaveBeenCalledWith('Report classified', {
                classification: expect.any(Object),
                reason: classificationResult.reason,
                reportId: reportToReview.id,
                traits: expect.any(Object),
            });
            expect(mockLogger.info).toHaveBeenCalledWith('Report classification completed', {
                failed: 0,
                successful: 1,
                totalReviewed: 1,
            });
        });

        test('should do nothing if no reports are pending review', async () => {
            // Given
            mockReportRepository.findMany.mockResolvedValue([]);

            // When
            await useCase.execute();

            // Then
            expect(mockReportClassificationAgent.run).not.toHaveBeenCalled();
            expect(mockReportRepository.update).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('No reports pending classification');
        });

        test('should continue processing even if one report fails classification', async () => {
            // Given
            const report1 = createMockReport(randomUUID());
            const report2 = createMockReport(randomUUID());
            mockReportRepository.findMany.mockResolvedValue([report1, report2]);

            mockReportClassificationAgent.run
                .mockResolvedValueOnce({
                    classification: new Classification('NICHE'),
                    reason: 'Interesting but for a specific audience.',
                    traits: new ArticleTraits({ smart: false, uplifting: true }),
                })
                .mockResolvedValueOnce(null); // Second report fails

            // When
            await useCase.execute();

            // Then
            expect(mockReportClassificationAgent.run).toHaveBeenCalledTimes(2);
            expect(mockReportRepository.update).toHaveBeenCalledWith(report1.id, {
                classification: expect.any(Object),
                traits: expect.any(Object),
            });
            expect(mockReportRepository.update).not.toHaveBeenCalledWith(
                report2.id,
                expect.any(Object),
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Classification agent returned no result',
                {
                    reportId: report2.id,
                },
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Report classification completed', {
                failed: 1,
                successful: 1,
                totalReviewed: 2,
            });
        });

        test('should handle errors during agent execution gracefully', async () => {
            // Given
            const agentError = new Error('AI agent failed');
            mockReportClassificationAgent.run.mockRejectedValue(agentError);

            // When
            await useCase.execute();

            // Then
            expect(mockReportRepository.update).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith('Error during report classification', {
                error: agentError,
                reportId: reportToReview.id,
            });
            expect(mockLogger.info).toHaveBeenCalledWith('Report classification completed', {
                failed: 1,
                successful: 0,
                totalReviewed: 1,
            });
        });

        test('should throw an error if fetching reports fails', async () => {
            // Given
            const repositoryError = new Error('Database connection failed');
            mockReportRepository.findMany.mockRejectedValue(repositoryError);

            // When / Then
            await expect(useCase.execute()).rejects.toThrow(repositoryError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Unhandled error during classification process',
                {
                    error: repositoryError,
                },
            );
        });
    });
});
