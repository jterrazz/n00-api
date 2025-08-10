import { type Report } from '../../../../domain/entities/report.entity.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * Repository port for report persistence operations
 */
export interface ReportRepositoryPort {
    /**
     * Appends new source article IDs to an existing report.
     * @param reportId - The ID of the report to update.
     * @param sourceIds - The new source IDs to add.
     */
    addSourceReferences(reportId: string, sourceIds: string[]): Promise<void>;

    /**
     * Create a new report
     */
    create(report: Report): Promise<Report>;

    /**
     * Create a new report marked as a suspected duplicate of a canonical report.
     */
    createDuplicate(report: Report, options: { duplicateOfId: string }): Promise<Report>;

    /**
     * Find a report by ID
     */
    findById(id: string): Promise<null | Report>;

    /**
     * Find reports by criteria
     */
    findMany(criteria: {
        category?: string;
        country?: string;
        endDate?: Date;
        limit?: number;
        offset?: number;
        startDate?: Date;
        where?: {
            classification?: 'PENDING_CLASSIFICATION';
        };
    }): Promise<Report[]>;

    /**
     * Finds the facts of recent reports for deduplication purposes.
     * @param options - Criteria to filter the reports.
     */
    findRecentFacts(options: {
        country: Country;
        language: Language;
        since: Date;
    }): Promise<Array<{ facts: string; id: string }>>;

    /**
     * Find reports that don't have any articles linked to them
     * Useful for identifying reports that need article implementation
     */
    findReportsWithoutArticles(criteria?: {
        category?: string;
        classification?: Array<'NICHE' | 'PENDING_CLASSIFICATION' | 'STANDARD'>;
        country?: string;
        limit?: number;
    }): Promise<Report[]>;

    /**
     * Get all existing source references (article IDs) to support deduplication
     * Limited to 5000 most recent entries, optionally filtered by country
     */
    getAllSourceReferences(country?: Country): Promise<string[]>;

    /**
     * Update a report's interest tier
     */
    update(id: string, data: Partial<Report>): Promise<Report>;
}
