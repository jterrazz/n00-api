import { z } from 'zod/v4';

import { Authenticity } from '../value-objects/article/authenticity.vo.js';
import { Body } from '../value-objects/article/body.vo.js';
import { Headline } from '../value-objects/article/headline.vo.js';
import { ArticleFrame } from '../value-objects/article-frame/article-frame.vo.js';
import { ArticleQuizQuestions } from '../value-objects/article-quiz-questions.vo.js';
import { ArticleTraits } from '../value-objects/article-traits.vo.js';
import { Categories } from '../value-objects/categories.vo.js';
import { Country } from '../value-objects/country.vo.js';
import { Language } from '../value-objects/language.vo.js';
import { Classification } from '../value-objects/report/tier.vo.js';

export const articleSchema = z.object({
    authenticity: z.instanceof(Authenticity),
    body: z.instanceof(Body),
    categories: z.instanceof(Categories),
    country: z.instanceof(Country),
    frames: z.array(z.instanceof(ArticleFrame)).optional(),
    headline: z.instanceof(Headline),
    id: z.uuid(),
    language: z.instanceof(Language),
    publishedAt: z.date(),
    quizQuestions: z.instanceof(ArticleQuizQuestions).optional(),
    reportIds: z.array(z.string()).optional(),
    tier: z.instanceof(Classification).optional(),
    traits: z.instanceof(ArticleTraits),
});

export type ArticleProps = z.input<typeof articleSchema>;

export class Article {
    public readonly authenticity: Authenticity;
    public readonly body: Body;
    public readonly categories: Categories;
    public readonly country: Country;
    public readonly frames?: ArticleFrame[];
    public readonly headline: Headline;
    public readonly id: string;
    public readonly language: Language;
    public readonly publishedAt: Date;
    public readonly quizQuestions?: ArticleQuizQuestions;
    public readonly reportIds?: string[];
    public readonly tier?: Classification;
    public readonly traits: ArticleTraits;

    public constructor(data: ArticleProps) {
        const result = articleSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid article data: ${result.error.message}`);
        }

        const validatedData = result.data;
        this.traits = validatedData.traits;
        this.categories = validatedData.categories;
        this.body = validatedData.body;
        this.country = validatedData.country;
        this.authenticity = validatedData.authenticity;
        this.tier = validatedData.tier;
        this.headline = validatedData.headline;
        this.id = validatedData.id;
        this.language = validatedData.language;
        this.publishedAt = validatedData.publishedAt;
        this.quizQuestions = validatedData.quizQuestions;
        this.reportIds = validatedData.reportIds;
        this.frames = validatedData.frames;
    }

    public isFabricated(): boolean {
        return this.authenticity.isFabricated();
    }

    /**
     * Determines if this article should show an authenticity challenge.
     * Always shows for fabricated articles, and for 20% of authentic articles
     * based on a deterministic hash of the article ID.
     */
    public shouldShowAuthenticityChallenge(): boolean {
        // Always show challenge for fabricated articles
        if (this.isFabricated()) {
            return true;
        }

        // Show for 20% of authentic articles based on ID hash
        // Remove dashes and take last 2 characters for consistent hashing
        const idHash = this.id.replace(/-/g, '').slice(-2);
        const numericValue = parseInt(idHash, 16);

        // 20% chance: modulo 5 equals 0 (1 in 5 articles)
        return numericValue % 5 === 0;
    }

    /**
     * Returns a plain, structured representation of the full article content.
     * Format: Headline, Body, then optional Subheadline/Subbody pairs for frames.
     */
    public toFullArticleContent(): string {
        const lines: string[] = [];
        lines.push(`Headline: ${this.headline.toString()}`);
        lines.push('');
        lines.push('Body:');
        lines.push(this.body.toString());

        if (this.frames && this.frames.length > 0) {
            for (const frame of this.frames) {
                lines.push('');
                lines.push(`Subheadline: ${frame.headline.toString()}`);
                lines.push('Subbody:');
                lines.push(frame.body.toString());
            }
        }

        return lines.join('\n');
    }
}
