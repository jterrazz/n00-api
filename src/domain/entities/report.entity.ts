import { z } from 'zod/v4';

import { ArticleTraits } from '../value-objects/article-traits.vo.js';
import { Categories } from '../value-objects/categories.vo.js';
import { Country } from '../value-objects/country.vo.js';
import { ReportAngle } from '../value-objects/report-angle/report-angle.vo.js';
import { Background } from '../value-objects/report/background.vo.js';
import { Core } from '../value-objects/report/core.vo.js';
import { DeduplicationState } from '../value-objects/report/deduplication-state.vo.js';
import { ClassificationState } from '../value-objects/report/tier-state.vo.js';
import { Classification } from '../value-objects/report/tier.vo.js';

export const coreSchema = z.instanceof(Core).describe('The core story being reported');

export const backgroundSchema = z
    .instanceof(Background)
    .describe('Contextual background information');

export const categoriesSchema = z
    .instanceof(Categories)
    .describe('The category classifications of the report.');

export const classificationStateSchema = z
    .instanceof(ClassificationState)
    .describe('The state of the classification process.');

export const classificationSchema = z
    .instanceof(Classification)
    .optional()
    .describe('The editorial classification assigned to the report.');

export const deduplicationStateSchema = z
    .instanceof(DeduplicationState)
    .describe('The state of the deduplication process.');

export const countrySchema = z
    .instanceof(Country)
    .describe('The country where the report is relevant.');

export const createdAtSchema = z
    .date()
    .describe('The timestamp when the report was first created in the system.');

export const datelineSchema = z
    .date()
    .describe('The publication date of the report, typically based on the source articles.');

export const idSchema = z.uuid().describe('The unique identifier for the report.');

export const anglesSchema = z
    .array(z.instanceof(ReportAngle))
    .describe('A list of different viewpoints or angles on the report.');

export const traitsSchema = z
    .instanceof(ArticleTraits)
    .optional()
    .describe('Content traits such as smart and uplifting characteristics.');

export const sourceReferencesSchema = z
    .array(z.string())
    .describe('A list of IDs from the original source articles used to create the report.');

export const updatedAtSchema = z.date().describe('The timestamp when the report was last updated.');

export const reportSchema = z.object({
    angles: anglesSchema,
    background: backgroundSchema,
    categories: categoriesSchema,
    classificationState: classificationStateSchema,
    core: coreSchema,
    country: countrySchema,
    createdAt: createdAtSchema,
    dateline: datelineSchema,
    deduplicationState: deduplicationStateSchema,
    id: idSchema,
    sourceReferences: sourceReferencesSchema,
    tier: classificationSchema,
    traits: traitsSchema,
    updatedAt: updatedAtSchema,
});

export type ReportProps = z.input<typeof reportSchema>;

/**
 * @description Represents a news report in the timeline of events
 */
export class Report {
    public readonly angles: ReportAngle[];
    public readonly background: Background;
    public readonly categories: Categories;
    public readonly classificationState: ClassificationState;
    public readonly core: Core;
    public readonly country: Country;
    public readonly createdAt: Date;
    public readonly dateline: Date;
    public readonly deduplicationState: DeduplicationState;
    public readonly id: string;
    public readonly sourceReferences: string[];
    public readonly tier?: Classification;
    public readonly traits?: ArticleTraits;
    public readonly updatedAt: Date;

    public constructor(data: ReportProps) {
        const result = reportSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid report data: ${result.error.message}`);
        }

        const validatedData = result.data;
        this.id = validatedData.id;
        this.core = validatedData.core;
        this.background = validatedData.background;
        this.traits = validatedData.traits;
        this.categories = validatedData.categories;
        this.angles = validatedData.angles;
        this.dateline = validatedData.dateline;
        this.sourceReferences = validatedData.sourceReferences;
        this.createdAt = validatedData.createdAt;
        this.updatedAt = validatedData.updatedAt;
        this.country = validatedData.country;
        this.classificationState = validatedData.classificationState;
        this.tier = validatedData.tier;
        this.deduplicationState = validatedData.deduplicationState;
    }
}
