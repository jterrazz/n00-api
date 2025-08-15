import { type LoggerPort } from '@jterrazz/logger';
import { type MonitoringPort } from '@jterrazz/monitoring';
import { z } from 'zod/v4';

// Application
import {
    type NewsArticle,
    type NewsOptions,
    type NewsProviderPort,
    type NewsReport,
} from '../../../application/ports/outbound/providers/news.port.js';

// Domain
import { Country } from '../../../domain/value-objects/country.vo.js';
import { Language } from '../../../domain/value-objects/language.vo.js';

import {
    createCurrentTZDateForCountry,
    formatTZDateForCountry,
} from '../../../shared/date/timezone.js';

// Constants
const RATE_LIMIT_DELAY = 1200; // 1.2 seconds between requests for safety margin
const API_BASE_URL = 'https://api.worldnewsapi.com';
const TOP_NEWS_ENDPOINT = '/top-news';
const DEFAULT_COUNTRY = 'US';
const DEFAULT_LANGUAGE = 'EN';
const DATE_FORMAT = 'yyyy-MM-dd';

// Types
export interface WorldNewsConfiguration {
    apiKey: string;
}

type WorldNewsArticle = z.infer<typeof worldNewsArticleSchema>;
type WorldNewsResponse = z.infer<typeof worldNewsResponseSchema>;

// Schemas
const worldNewsArticleSchema = z.object({
    id: z.number(),
    publish_date: z.string(),
    text: z.string(),
    title: z.string(),
});

const worldNewsResponseSchema = z.object({
    country: z.string(),
    language: z.string(),
    top_news: z.array(
        z.object({
            news: z.array(worldNewsArticleSchema),
        }),
    ),
});

export class WorldNews implements NewsProviderPort {
    private lastRequestTime = 0;

    constructor(
        private readonly configuration: WorldNewsConfiguration,
        private readonly logger: LoggerPort,
        private readonly monitoring: MonitoringPort,
    ) {}

    public async fetchNews(options?: NewsOptions): Promise<NewsReport[]> {
        const {
            country = new Country(DEFAULT_COUNTRY),
            language = new Language(DEFAULT_LANGUAGE),
        } = options || {};

        return this.monitoring.monitorSegment('Api/WorldNews/FetchNews', async () => {
            try {
                this.logger.debug('Fetching news from WorldNews API', {
                    country: country.toString(),
                    language: language.toString(),
                });
                await this.enforceRateLimit();

                const url = this.buildApiUrl(country, language);
                const response = await this.makeApiRequest(url);
                const stories = await this.processApiResponse(response);

                this.logger.info('Successfully fetched news from WorldNews API', {
                    country: country.toString(),
                    language: language.toString(),
                    reportCount: stories.length,
                });
                return stories;
            } catch (error) {
                this.monitoring.recordCount('WorldNews', 'Errors');
                this.logger.error('Failed to fetch news from WorldNews API', {
                    country: country.toString(),
                    error,
                    language: language.toString(),
                });
                return [];
            }
        });
    }

    private buildApiUrl(country: Country, language: Language): URL {
        const tzDate = createCurrentTZDateForCountry(country.toString());
        const countryDate = formatTZDateForCountry(tzDate, country.toString(), DATE_FORMAT);
        const url = new URL(`${API_BASE_URL}${TOP_NEWS_ENDPOINT}`);

        url.searchParams.append('api-key', this.configuration.apiKey);
        url.searchParams.append('source-country', country.toString());
        url.searchParams.append('language', language.toString());
        url.searchParams.append('date', countryDate);

        this.logger.debug('Constructed WorldNews API URL', {
            country: country.toString(),
            countryDate,
        });

        return url;
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
            this.monitoring.recordMeasurement('WorldNews/RateLimit', 'WaitTime', waitTime);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    private async makeApiRequest(url: URL): Promise<Response> {
        const response = await fetch(url.toString());

        if (!response.ok) {
            this.monitoring.recordCount('WorldNews', 'Errors');
            this.logger.error('WorldNews API returned an error response', {
                status: response.status,
                statusText: response.statusText,
                url: url.toString(),
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    private async processApiResponse(response: Response): Promise<NewsReport[]> {
        const data = await response.json();
        const parsed = worldNewsResponseSchema.parse(data);
        return this.transformResponse(parsed);
    }

    private transformResponse(response: WorldNewsResponse): NewsReport[] {
        return response.top_news
            .map((section) => this.transformSection(section))
            .filter(Boolean) as NewsReport[];
    }

    private transformSection(section: { news: WorldNewsArticle[] }): NewsReport | undefined {
        if (section.news.length === 0) {
            return undefined;
        }

        const articles: NewsArticle[] = section.news.map((article) => ({
            body: article.text,
            headline: article.title,
            id: `worldnewsapi:${article.id}`,
        }));

        // Calculate the average date from all articles
        const articleDates = section.news.map((article) =>
            new Date(article.publish_date).getTime(),
        );
        const averageTimestamp =
            articleDates.reduce((sum, timestamp) => sum + timestamp, 0) / articleDates.length;
        const reportDate = new Date(averageTimestamp);

        return {
            articles,
            publishedAt: reportDate,
        };
    }
}
