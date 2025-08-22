import { type LoggerPort } from '@jterrazz/logger';

// Domain
import { ClassificationState } from '../../../domain/value-objects/report/tier-state.vo.js';

// Ports
import { type ReportClassificationAgentPort } from '../../ports/outbound/agents/report-classification.agent.js';
import { type ReportRepositoryPort } from '../../ports/outbound/persistence/report/report-repository.port.js';

/**
 * Use case for classifying reports
 * @description Reviews reports that are pending classification and assigns them appropriate classifications
 */
export class ClassifyReportsUseCase {
    constructor(
        private readonly reportClassificationAgent: ReportClassificationAgentPort,
        private readonly logger: LoggerPort,
        private readonly reportRepository: ReportRepositoryPort,
    ) {}

    /**
     * Execute the report classification process
     * @description Finds reports pending classification and processes them through the AI agent
     */
    public async execute(): Promise<void> {
        this.logger.info('Starting report classification');

        let successfulClassifications = 0;
        let failedClassifications = 0;

        try {
            // Fetch reports that need to be classified
            const reportsToReview = await this.reportRepository.findMany({
                limit: 50,
                where: { classificationState: 'PENDING' },
            });

            if (reportsToReview.length === 0) {
                this.logger.info('No reports pending classification');
                return;
            }

            this.logger.info('Reports found for classification', { count: reportsToReview.length });

            // Process each report through the classification agent
            for (const report of reportsToReview) {
                try {
                    const result = await this.reportClassificationAgent.run({ report });

                    if (result) {
                        await this.reportRepository.update(report.id, {
                            classificationState: new ClassificationState('COMPLETE'),
                            tier: result.classification,
                            traits: result.traits,
                        });

                        this.logger.info('Report classified', {
                            classification: result.classification,
                            reason: result.reason,
                            reportId: report.id,
                            traits: result.traits,
                        });
                        successfulClassifications++;
                    } else {
                        this.logger.warn('Classification agent returned no result', {
                            reportId: report.id,
                        });
                        failedClassifications++;
                    }
                } catch (error) {
                    this.logger.error('Error during report classification', {
                        error,
                        reportId: report.id,
                    });
                    failedClassifications++;
                }
            }
        } catch (error) {
            this.logger.error('Unhandled error during classification process', {
                error,
            });
            throw error;
        }

        this.logger.info('Report classification completed', {
            failed: failedClassifications,
            successful: successfulClassifications,
            totalReviewed: successfulClassifications + failedClassifications,
        });
    }
}
