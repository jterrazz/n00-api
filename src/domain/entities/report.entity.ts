import { z } from 'zod/v4';

import { Category } from '../value-objects/category.vo.js';
import { Country } from '../value-objects/country.vo.js';
import { Classification } from '../value-objects/report/classification.vo.js';
import { ReportAngle } from '../value-objects/report-angle/report-angle.vo.js';

export const factsSchema = z
    .string()
    .describe(
        'Facts are a concise, information-dense collection of essential data points, key actors, and the core narrative in ~50 words. Example: "Tesla CEO Musk acquires Twitter ($44B, Oct 2022), fires executives, adds $8 verification fee, restores suspended accounts, triggers advertiser exodus (GM, Pfizer), 75 % staff cuts, sparks free-speech vs. safety debate."',
    );

export const categorySchema = z
    .instanceof(Category)
    .describe('The primary category classification of the report.');

export const classificationSchema = z
    .instanceof(Classification)
    .describe('The editorial classification assigned to the report.');

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

export const sourceReferencesSchema = z
    .array(z.string())
    .describe('A list of IDs from the original source articles used to create the report.');

export const updatedAtSchema = z.date().describe('The timestamp when the report was last updated.');

export const reportSchema = z.object({
    angles: anglesSchema,
    category: categorySchema,
    classification: classificationSchema,
    country: countrySchema,
    createdAt: createdAtSchema,
    dateline: datelineSchema,
    facts: factsSchema,
    id: idSchema,
    sourceReferences: sourceReferencesSchema,
    updatedAt: updatedAtSchema,
});

export type ReportProps = z.input<typeof reportSchema>;

/**
 * @description Represents a news report in the timeline of events
 */
export class Report {
    public readonly angles: ReportAngle[];
    public readonly category: Category;
    public readonly classification: Classification;
    public readonly country: Country;
    public readonly createdAt: Date;
    public readonly dateline: Date;
    public readonly facts: string;
    public readonly id: string;
    public readonly sourceReferences: string[];
    public readonly updatedAt: Date;

    public constructor(data: ReportProps) {
        const result = reportSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid report data: ${result.error.message}`);
        }

        const validatedData = result.data;
        this.id = validatedData.id;
        this.facts = validatedData.facts;
        this.category = validatedData.category;
        this.angles = validatedData.angles;
        this.dateline = validatedData.dateline;
        this.sourceReferences = validatedData.sourceReferences;
        this.createdAt = validatedData.createdAt;
        this.updatedAt = validatedData.updatedAt;
        this.country = validatedData.country;
        this.classification = validatedData.classification;
    }
}
