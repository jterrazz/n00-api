import { randomUUID } from 'crypto';

import { getCategory } from '../../value-objects/__mocks__/categories.mock.js';
import { getCountry } from '../../value-objects/__mocks__/countries.mock.js';
import { getClassification } from '../../value-objects/report/__mocks__/classifications.mock.js';
import { mockReportAngles } from '../../value-objects/report-angle/__mocks__/report-angles.mock.js';
import { type ReportAngle } from '../../value-objects/report-angle/report-angle.vo.js';
import { Report } from '../report.entity.js';

/**
 * Generates a single mock `Report` with optional overrides.
 */
export function getMockReport(options?: {
    angles?: ReportAngle[];
    categoryIndex?: number;
    classificationIndex?: number;
    countryIndex?: number;
    id?: string;
}): Report {
    const reportId = options?.id || randomUUID();
    return new Report({
        angles: options?.angles || mockReportAngles(1),
        category:
            options?.categoryIndex !== undefined
                ? getCategory(options.categoryIndex)
                : getCategory(0),
        classification:
            options?.classificationIndex !== undefined
                ? getClassification(options.classificationIndex)
                : getClassification(2),
        country:
            options?.countryIndex !== undefined ? getCountry(options.countryIndex) : getCountry(0),
        createdAt: new Date(),
        dateline: new Date(),
        facts: 'Mock Report Facts: A comprehensive list of key political developments across multiple regions, outlining actors, timelines, and data points that shape the public discourse on this evolving situation.',
        id: reportId,
        sourceReferences: ['worldnewsapi:mock-article-1', 'worldnewsapi:mock-article-2'],
        updatedAt: new Date(),
    });
}

/**
 * Generates an array of mock `Report` entities.
 */
export function getMockReports(count: number): Report[] {
    return Array.from({ length: count }, (_, index) => createMockReport(index));
}

function createMockReport(index: number): Report {
    const category = getCategory(index);
    const classification = getClassification(index + 1);
    const reportId = randomUUID();
    return new Report({
        angles: mockReportAngles(2),
        category,
        classification,
        country: getCountry(index + 1),
        createdAt: new Date(),
        dateline: new Date(),
        facts: `These are key facts for report ${index}. Topic: ${category.toString()}. It lists all major events, actors, and evidence in a concise factual format long enough to satisfy validation requirements.`,
        id: reportId,
        sourceReferences: [`source-ref-${index}`],
        updatedAt: new Date(),
    });
}
