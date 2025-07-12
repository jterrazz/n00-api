import { type Category } from '../../../../domain/value-objects/category.vo.js';
import { type DiscourseValue } from '../../../../domain/value-objects/discourse.vo.js';
import { type StanceValue } from '../../../../domain/value-objects/stance.vo.js';

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
 * Result of report ingestion containing structured angles and facts
 */
export interface ReportIngestionResult {
    angles: Array<{
        corpus: string;
        discourse: DiscourseValue;
        stance: StanceValue;
    }>;
    category: Category;
    facts: string;
}
