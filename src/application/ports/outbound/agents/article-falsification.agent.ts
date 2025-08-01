import { type Categories } from '../../../../domain/value-objects/categories.vo.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * @description
 * Port for the Article Falsification Agent that generates convincing but fake news articles
 */
export interface ArticleFalsificationAgentPort {
    run(input: ArticleFalsificationInput): Promise<ArticleFalsificationResult | null>;
}

/**
 * @description
 * Input data required for fabricated article generation
 */
export interface ArticleFalsificationInput {
    context?: {
        currentDate?: Date;
        recentArticles?: Array<{
            body: string;
            frames?: Array<{ body: string; headline: string }>;
            headline: string;
            publishedAt: string;
        }>;
    };
    targetCountry: Country;
    targetLanguage: Language;
}

/**
 * @description
 * Result of fabricated article generation containing the article content and metadata
 */
export interface ArticleFalsificationResult {
    body: string;
    categories: Categories;
    clarification: string;
    headline: string;
    /**
     * Index of the recentArticles array **after** which this fake article should be inserted
     * to preserve a coherent timeline. If no suitable article is found or the list is empty,
     * the value should be `-1` indicating it should be placed at the very beginning.
     */
    insertAfterIndex?: number;
    tone: 'satirical';
}

/**
 * @description
 * The tone/style of fake article to generate
 */
export type FakeArticleTone = 'satirical' | 'serious';
