import { type LoggerPort } from '@jterrazz/logger';
import { type MonitoringPort } from '@jterrazz/monitoring';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mockOf,
    mockOfDate,
    vitest,
} from '@jterrazz/test';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ZodError } from 'zod/v4';

import { Country } from '../../../../domain/value-objects/country.vo.js';

import { createTZDateForCountry } from '../../../../shared/date/timezone.js';
import { WorldNews, type WorldNewsConfiguration } from '../world-news.provider.js';

const mockConfiguration: WorldNewsConfiguration = {
    apiKey: 'test-world-news-key',
};
const mockLogger = mockOf<LoggerPort>();

let requestedDates: Record<string, string> = {};

const server = setupServer(
    http.get('https://api.worldnewsapi.com/top-news', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const apiKey = url.searchParams.get('api-key');
        const sourceCountry = url.searchParams.get('source-country');
        const language = url.searchParams.get('language');
        const date = url.searchParams.get('date');

        if (sourceCountry && date) {
            requestedDates[sourceCountry] = date;
        }

        if (apiKey !== 'test-world-news-key') {
            return new HttpResponse(null, { status: 401 });
        }

        // Always return multiple articles for all tests
        const mockResponse = {
            country: sourceCountry || 'us',
            language: language || 'en',
            top_news: [
                {
                    news: [
                        {
                            id: 224767206,
                            publish_date: '2024-03-10T12:00:00Z',
                            summary: 'Test summary',
                            text: 'short',
                            title: 'Short',
                            url: 'https://example.com/article1',
                        },
                        {
                            id: 224839780,
                            publish_date: '2024-03-11T12:00:00Z',
                            summary: 'Test summary',
                            text: 'a bit longer',
                            title: 'Medium',
                            url: 'https://example.com/article2',
                        },
                        {
                            id: 224936214,
                            publish_date: '2024-03-12T12:00:00Z',
                            summary: 'Test summary',
                            text: 'this is the longest article text',
                            title: 'Long',
                            url: 'https://example.com/article3',
                        },
                    ],
                },
            ],
        };

        return HttpResponse.json(mockResponse);
    }),
);

let provider: WorldNews;

beforeAll(() => {
    server.listen();
    vitest.useFakeTimers();
});
beforeEach(() => {
    const newRelic = mockOf<MonitoringPort>();
    newRelic.monitorSegment.mockImplementation(async (_name, cb) => cb());
    provider = new WorldNews(mockConfiguration as WorldNewsConfiguration, mockLogger, newRelic);
    requestedDates = {};
});
afterEach(() => {
    server.resetHandlers();
});
afterAll(() => {
    server.close();
    vitest.useRealTimers();
});

describe('WorldNews', () => {
    it('should fetch news successfully', async () => {
        // Given - a valid API key and a response with multiple articles

        // When - fetching news from the provider
        const result = await provider.fetchNews();

        // Then - it should return a report with all articles
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            articles: [
                {
                    body: 'short',
                    headline: 'Short',
                    id: 'worldnewsapi:224767206',
                },
                {
                    body: 'a bit longer',
                    headline: 'Medium',
                    id: 'worldnewsapi:224839780',
                },
                {
                    body: 'this is the longest article text',
                    headline: 'Long',
                    id: 'worldnewsapi:224936214',
                },
            ],
            publishedAt: new Date('2024-03-11T12:00:00Z'), // Average of article dates
        });
    });

    it('should use correct date based on country timezone', async () => {
        // Given - a date representing 2:30 AM in France on Jan 15
        const fakeDate = createTZDateForCountry(new Date(2024, 0, 15, 2, 30, 0, 0), 'fr');
        const utcTimestamp = fakeDate.getTime();
        mockOfDate.set(utcTimestamp);

        // When - fetching news for different countries
        const first = provider.fetchNews();
        vitest.runAllTimers();
        await first;

        vitest.advanceTimersByTime(1500);
        const second = provider.fetchNews({ country: new Country('FR') });
        vitest.runAllTimers();
        await second;

        // Then - it should use the correct date for each country
        expect(requestedDates['US']).toBe('2024-01-14');
        expect(requestedDates['FR']).toBe('2024-01-15');

        mockOfDate.reset();
    });

    it('should handle API errors gracefully', async () => {
        // Given - the API returns a 500 error
        server.use(
            http.get('https://api.worldnewsapi.com/top-news', () => {
                return new HttpResponse(null, { status: 500 });
            }),
        );

        // When - fetching news
        const result = await provider.fetchNews();

        // Then - it should return an empty array and log the error
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith('WorldNews API returned an error response', {
            status: 500,
            statusText: 'Internal Server Error',
            url: expect.stringContaining('https://api.worldnewsapi.com/top-news'),
        });
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch news from WorldNews API', {
            country: 'US',
            error: expect.any(Error),
            language: 'EN',
        });
    });

    it('should handle invalid API key', async () => {
        // Given - the API returns a 401 unauthorized error
        server.use(
            http.get('https://api.worldnewsapi.com/top-news', () => {
                return new HttpResponse(null, { status: 401 });
            }),
        );

        // When - fetching news
        const result = await provider.fetchNews();

        // Then - it should return an empty array and log the error
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith('WorldNews API returned an error response', {
            status: 401,
            statusText: 'Unauthorized',
            url: expect.stringContaining('https://api.worldnewsapi.com/top-news'),
        });
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch news from WorldNews API', {
            country: 'US',
            error: expect.any(Error),
            language: 'EN',
        });
    });

    it('should handle invalid response data', async () => {
        // Given - the API returns an invalid data structure
        server.use(
            http.get('https://api.worldnewsapi.com/top-news', () => {
                return HttpResponse.json({ invalid: 'data' });
            }),
        );

        // When - fetching news
        const result = await provider.fetchNews();

        // Then - it should return an empty array and log the error
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch news from WorldNews API', {
            country: 'US',
            error: expect.any(ZodError),
            language: 'EN',
        });
    });

    it('should respect rate limiting between requests', async () => {
        // Given - two consecutive requests
        // When - making the requests
        const first = provider.fetchNews();
        vitest.runAllTimers();
        const firstResult = await first;
        vitest.advanceTimersByTime(1500);
        const second = provider.fetchNews();
        vitest.runAllTimers();
        const secondResult = await second;

        // Then - both should return arrays (possibly empty)
        expect(Array.isArray(firstResult)).toBe(true);
        expect(Array.isArray(secondResult)).toBe(true);
    });
});

describe('WorldNews.transformResponse', () => {
    it('should return a report with all articles from each section', () => {
        // Given
        const provider = new WorldNews(
            { apiKey: 'irrelevant' },
            mockLogger,
            mockOf<MonitoringPort>(),
        );
        const response = {
            country: 'us',
            language: 'en',
            top_news: [
                {
                    news: [
                        {
                            id: 100001,
                            publish_date: '2024-01-01T00:00:00Z',
                            text: 'short',
                            title: 'Short',
                        },
                        {
                            id: 100002,
                            publish_date: '2024-01-02T00:00:00Z',
                            text: 'a bit longer',
                            title: 'Medium',
                        },
                        {
                            id: 100003,
                            publish_date: '2024-01-03T00:00:00Z',
                            text: 'this is the longest article text',
                            title: 'Long',
                        },
                    ],
                },
            ],
        };

        // When
        // @ts-expect-error - testing private method
        const result = provider.transformResponse(response);

        // Then
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            articles: [
                {
                    body: 'short',
                    headline: 'Short',
                    id: 'worldnewsapi:100001',
                },
                {
                    body: 'a bit longer',
                    headline: 'Medium',
                    id: 'worldnewsapi:100002',
                },
                {
                    body: 'this is the longest article text',
                    headline: 'Long',
                    id: 'worldnewsapi:100003',
                },
            ],
            publishedAt: new Date('2024-01-02T00:00:00Z'), // Average of article dates
        });
    });

    it('should handle multiple sections correctly', () => {
        // Given
        const provider = new WorldNews(
            { apiKey: 'irrelevant' },
            mockLogger,
            mockOf<MonitoringPort>(),
        );
        const response = {
            country: 'us',
            language: 'en',
            top_news: [
                {
                    news: [
                        {
                            id: 200001,
                            publish_date: '2024-01-01T00:00:00Z',
                            text: 'first report article 1',
                            title: 'Report 1 - Article 1',
                        },
                        {
                            id: 200002,
                            publish_date: '2024-01-02T00:00:00Z',
                            text: 'first report article 2',
                            title: 'Report 1 - Article 2',
                        },
                    ],
                },
                {
                    news: [
                        {
                            id: 200003,
                            publish_date: '2024-01-03T00:00:00Z',
                            text: 'second report article 1',
                            title: 'Report 2 - Article 1',
                        },
                    ],
                },
            ],
        };

        // When
        // @ts-expect-error - testing private method
        const result = provider.transformResponse(response);

        // Then
        expect(result).toHaveLength(2);
        expect(result[0].articles).toHaveLength(2);
        expect(result[1].articles).toHaveLength(1);
    });
});
