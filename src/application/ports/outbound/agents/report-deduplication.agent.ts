import { type NewsReport } from '../providers/news.port.js';

export interface ReportDeduplicationAgentPort {
    readonly name: string;
    run(params: {
        existingReports: Array<{ background: string; core: string; id: string }>;
        newReport: NewsReport;
    }): Promise<null | ReportDeduplicationResult>;
}

/**
 * Defines the contract for the Report Deduplication Agent.
 * This agent is responsible for determining if a new report is a semantic
 * duplicate of an existing one.
 */
export type ReportDeduplicationResult = {
    /** The ID of the existing report if it's a duplicate, otherwise null. */
    duplicateOfReportId: null | string;
};
