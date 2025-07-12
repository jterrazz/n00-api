import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * Individual article within a report
 */
export interface NewsArticle {
    body: string;
    headline: string;
    id: string;
}

/**
 * Options for fetching news reports
 */
export interface NewsOptions {
    country?: Country;
    language?: Language;
}

/**
 * News provider port - defines how to fetch news reports from external providers
 */
export interface NewsProviderPort {
    /**
     * Fetch news reports (each containing multiple articles) based on language and country
     */
    fetchNews(options?: NewsOptions): Promise<NewsReport[]>;
}

/**
 * News report containing multiple articles/angles
 */
export interface NewsReport {
    articles: NewsArticle[];
    publishedAt: Date;
}
