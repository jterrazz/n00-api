// Domain
import { type Categories } from '../../../../domain/value-objects/categories.vo.js';

import { type NewsReport } from '../providers/news.port.js';

/**
 * @description
 * Port for the Report Ingestion Agent that processes raw news articles
 * into structured report data with angles and facts
 */
export interface ReportIngestionAgentPort {
    run(params: { newsReport: NewsReport }): Promise<null | ReportIngestionResult>;
}

/**
 * @description
 * Result of report ingestion containing structured core story, background context, and angle narratives
 */
export interface ReportIngestionResult {
    angles: Array<{
        narrative: string;
    }>;
    background: string;
    categories: Categories;
    core: string;
}
