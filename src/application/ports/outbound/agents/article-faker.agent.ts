import { type Category } from '../../../../domain/value-objects/category.vo.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * @description
 * Port for the Article Faker Agent that generates convincing but fake news articles
 */
export interface ArticleFakerAgentPort {
    run(input: ArticleFakerInput): Promise<ArticleFakerResult | null>;
}

/**
 * @description
 * Input data required for fake article generation
 */
export interface ArticleFakerInput {
    context?: {
        currentDate?: Date;
        recentArticles?: Array<{
            body: string;
            frames?: Array<{ body: string; headline: string }>;
            headline: string;
            publishedAt: string;
        }>;
    };
    targetCategory?: Category; // Optional - AI will choose if not provided
    targetCountry: Country;
    targetLanguage: Language;
    tone?: FakeArticleTone; // defaults to 'random'
}

/**
 * @description
 * Result of fake article generation containing the fake article content and metadata
 */
export interface ArticleFakerResult {
    body: string;
    category: Category;
    fakeReason: string;
    headline: string;
    tone: 'satirical' | 'serious'; // indicates which style was actually generated
}

/**
 * @description
 * The tone/style of fake article to generate
 */
export type FakeArticleTone = 'random' | 'satirical' | 'serious';
