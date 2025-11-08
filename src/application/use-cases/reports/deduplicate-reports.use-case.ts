import { type LoggerPort } from '@jterrazz/logger';

// Domain
import { type Report } from '../../../domain/entities/report.entity.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { DeduplicationState } from '../../../domain/value-objects/report/deduplication-state.vo.js';

// Ports
import { type ReportDeduplicationAgentPort } from '../../ports/outbound/agents/report-deduplication.agent.js';
import { type ReportRepositoryPort } from '../../ports/outbound/persistence/report/report-repository.port.js';

/**
 * Use case for detecting and resolving duplicate reports
 * @description Processes reports with pending deduplication state to identify semantic duplicates
 */
export class DeduplicateReportsUseCase {
    constructor(
        private readonly reportDeduplicationAgent: ReportDeduplicationAgentPort,
        private readonly logger: LoggerPort,
        private readonly reportRepository: ReportRepositoryPort,
    ) {}

    /**
     * Process reports with pending deduplication state to detect and resolve duplicates
     * @param country - Target country for deduplication processing
     * @returns Array of processed reports with updated deduplication status
     */
    public async execute(country?: Country): Promise<Report[]> {
        try {
            this.logger.info('Starting report deduplication process', {
                country: country?.toString() || 'all',
            });

            // Step 1: Find reports that need deduplication
            const pendingReports = await this.reportRepository.findReportsWithPendingDeduplication({
                country: country?.toString(),
                limit: 50, // Process in batches to avoid overwhelming the system
            });

            if (pendingReports.length === 0) {
                this.logger.info('No reports pending deduplication', {
                    country: country?.toString() || 'all',
                });
                return [];
            }

            this.logger.info('Reports found for deduplication', {
                count: pendingReports.length,
                country: country?.toString() || 'all',
            });

            // Step 2: Get recent reports for comparison (excluding the pending ones)
            const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7); // 7 days ago
            const existingReports = await this.reportRepository.findRecentReports({
                country: country?.toString(),
                excludeIds: pendingReports.map((r: Report) => r.id),
                limit: 1000,
                since, // Get a good sample for comparison
            });

            this.logger.info('Existing reports loaded for comparison', {
                count: existingReports.length,
            });

            // Step 3: Process each pending report
            const processedReports: Report[] = [];
            let duplicatesFound = 0;

            for (const pendingReport of pendingReports) {
                try {
                    let duplicateOfId: null | string = null;

                    // Only check for duplicates if we have reports to compare against
                    if (existingReports.length > 0) {
                        // Convert Report entity to NewsReport format for agent
                        const mockNewsReport = {
                            articles: [], // We don't have the original articles
                            publishedAt: pendingReport.dateline,
                        };

                        const deduplicationResult = await this.reportDeduplicationAgent.run({
                            existingReports: existingReports.map((report: Report) => ({
                                background: report.background.value,
                                core: report.core.value,
                                id: report.id,
                            })),
                            newReport: mockNewsReport,
                        });

                        if (deduplicationResult?.duplicateOfReportId) {
                            duplicateOfId = deduplicationResult.duplicateOfReportId;
                            this.logger.info('Report identified as duplicate', {
                                duplicateOf: duplicateOfId,
                                reportId: pendingReport.id,
                            });
                        }
                    }

                    // Step 4: Update the report based on deduplication result
                    let updatedReport: Report;

                    if (duplicateOfId) {
                        // Mark as duplicate and link to canonical report
                        updatedReport = await this.reportRepository.markAsDuplicate(
                            pendingReport.id,
                            {
                                duplicateOfId,
                            },
                        );
                        duplicatesFound++;
                        this.logger.info('Report marked as duplicate', {
                            duplicateOf: duplicateOfId,
                            reportId: pendingReport.id,
                        });
                    } else {
                        // Mark as unique (not a duplicate)
                        updatedReport = await this.reportRepository.update(pendingReport.id, {
                            deduplicationState: new DeduplicationState('COMPLETE'),
                        });
                        this.logger.info('Report marked as unique', {
                            reportId: pendingReport.id,
                        });
                    }

                    processedReports.push(updatedReport);
                } catch (reportError) {
                    this.logger.warn('Error processing report for deduplication', {
                        error: reportError,
                        reportId: pendingReport.id,
                    });

                    // Mark as complete even if there was an error to avoid infinite retries
                    try {
                        const errorUpdatedReport = await this.reportRepository.update(
                            pendingReport.id,
                            {
                                deduplicationState: new DeduplicationState('COMPLETE'),
                            },
                        );
                        processedReports.push(errorUpdatedReport);
                    } catch (updateError) {
                        this.logger.error('Failed to update report after deduplication error', {
                            error: updateError,
                            reportId: pendingReport.id,
                        });
                    }
                }
            }

            this.logger.info('Report deduplication process completed', {
                country: country?.toString() || 'all',
                duplicatesFound,
                processedCount: processedReports.length,
                uniqueReports: processedReports.length - duplicatesFound,
            });

            return processedReports;
        } catch (error) {
            this.logger.error('Report deduplication encountered an error', {
                country: country?.toString() || 'all',
                error,
            });
            throw error;
        }
    }
}
