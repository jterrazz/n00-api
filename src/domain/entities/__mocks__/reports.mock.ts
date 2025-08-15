import { randomUUID } from 'crypto';

import { getCategory } from '../../value-objects/__mocks__/categories.mock.js';
import { getCountry } from '../../value-objects/__mocks__/countries.mock.js';
import { ArticleTraits } from '../../value-objects/article-traits.vo.js';
import { Categories } from '../../value-objects/categories.vo.js';
import { mockReportAngles } from '../../value-objects/report-angle/__mocks__/report-angles.mock.js';
import { type ReportAngle } from '../../value-objects/report-angle/report-angle.vo.js';
import { getClassification } from '../../value-objects/report/__mocks__/tiers.mock.js';
import { Background } from '../../value-objects/report/background.vo.js';
import { Core } from '../../value-objects/report/core.vo.js';
import { DeduplicationState } from '../../value-objects/report/deduplication-state.vo.js';
import { ClassificationState } from '../../value-objects/report/tier-state.vo.js';
import { Report } from '../report.entity.js';

/**
 * Generates a single mock `Report` with optional overrides.
 */
export function getMockReport(options?: {
    angles?: ReportAngle[];
    categoryIndex?: number;
    countryIndex?: number;
    id?: string;
    tierIndex?: number;
}): Report {
    const reportId = options?.id || randomUUID();
    return new Report({
        angles: options?.angles || mockReportAngles(1),
        categories: new Categories([
            (options?.categoryIndex !== undefined
                ? getCategory(options.categoryIndex)
                : getCategory(0)
            ).value,
        ]),
        classificationState: new ClassificationState('COMPLETE'),
        country:
            options?.countryIndex !== undefined ? getCountry(options.countryIndex) : getCountry(0),
        createdAt: new Date(),
        dateline: new Date(),
        background: new Background(
            'Mock background context providing comprehensive contextual information for understanding the story.',
        ),
        core: new Core(
            'Mock core story representing the main narrative being reported with sufficient detail for validation.',
        ),
        deduplicationState: new DeduplicationState('COMPLETE'),
        id: reportId,
        sourceReferences: ['worldnewsapi:mock-article-1', 'worldnewsapi:mock-article-2'],
        tier:
            options?.tierIndex !== undefined
                ? getClassification(options.tierIndex)
                : getClassification(0),
        traits: new ArticleTraits(),
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
    const tier = getClassification(index + 1);
    const reportId = randomUUID();
    return new Report({
        angles: mockReportAngles(2),
        categories: new Categories([category.value]),
        classificationState: new ClassificationState('COMPLETE'),
        country: getCountry(index + 1),
        createdAt: new Date(),
        dateline: new Date(),
        background: new Background(
            `Background context for report ${index} providing comprehensive contextual information. Topic: ${category.toString()}.`,
        ),
        core: new Core(
            `Core story for report ${index} representing the main narrative. Topic: ${category.toString()}. Contains sufficient detail for validation.`,
        ),
        deduplicationState: new DeduplicationState('COMPLETE'),
        id: reportId,
        sourceReferences: [`source-ref-${index}`],
        tier,
        traits: new ArticleTraits(),
        updatedAt: new Date(),
    });
}
