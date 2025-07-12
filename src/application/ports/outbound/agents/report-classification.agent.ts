import { type Report } from '../../../../domain/entities/report.entity.js';
import {
    Classification,
    classificationSchema,
} from '../../../../domain/value-objects/report/classification.vo.js';

export { Classification, classificationSchema };

/**
 * @description
 * Port for the Report Classification Agent that determines report priority and audience relevance
 */
export interface ReportClassificationAgentPort {
    run(input: ReportClassificationInput): Promise<null | ReportClassificationResult>;
}

/**
 * @description
 * Input data required for report classification
 */
export interface ReportClassificationInput {
    report: Report;
}

/**
 * @description
 * Result of report classification containing the assigned classification and reasoning
 */
export interface ReportClassificationResult {
    classification: Classification;
    reason: string;
}
