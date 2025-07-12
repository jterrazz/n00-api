import { z } from 'zod/v4';

import { Authenticity } from '../value-objects/article/authenticity.vo.js';
import { Body } from '../value-objects/article/body.vo.js';
import { Headline } from '../value-objects/article/headline.vo.js';
import { ArticleFrame } from '../value-objects/article-frame/article-frame.vo.js';
import { Category } from '../value-objects/category.vo.js';
import { Country } from '../value-objects/country.vo.js';
import { Language } from '../value-objects/language.vo.js';
import { Classification } from '../value-objects/report/classification.vo.js';

export const articleSchema = z.object({
    authenticity: z.instanceof(Authenticity),
    body: z.instanceof(Body),
    category: z.instanceof(Category),
    classification: z.instanceof(Classification).optional(),
    country: z.instanceof(Country),
    frames: z.array(z.instanceof(ArticleFrame)).optional(),
    headline: z.instanceof(Headline),
    id: z.uuid(),
    language: z.instanceof(Language),
    publishedAt: z.date(),
    reportIds: z.array(z.string()).optional(),
});

export type ArticleProps = z.input<typeof articleSchema>;

export class Article {
    public readonly authenticity: Authenticity;
    public readonly body: Body;
    public readonly category: Category;
    public readonly classification?: Classification;
    public readonly country: Country;
    public readonly frames?: ArticleFrame[];
    public readonly headline: Headline;
    public readonly id: string;
    public readonly language: Language;
    public readonly publishedAt: Date;
    public readonly reportIds?: string[];

    public constructor(data: ArticleProps) {
        const result = articleSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid article data: ${result.error.message}`);
        }

        const validatedData = result.data;
        this.category = validatedData.category;
        this.body = validatedData.body;
        this.country = validatedData.country;
        this.authenticity = validatedData.authenticity;
        this.classification = validatedData.classification;
        this.headline = validatedData.headline;
        this.id = validatedData.id;
        this.language = validatedData.language;
        this.publishedAt = validatedData.publishedAt;
        this.reportIds = validatedData.reportIds;
        this.frames = validatedData.frames;
    }

    public isFake(): boolean {
        return this.authenticity.isFake;
    }
}
