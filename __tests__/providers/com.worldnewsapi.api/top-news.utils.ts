import { HttpResponse } from 'msw';

export const TEST_API_KEY = 'test-world-news-key';

export interface TopNewsQueryParams {
    apiKey: null | string;
    date: null | string;
    language: null | string;
    sourceCountry: null | string;
}

/**
 * Deterministically builds a top-news payload with 5 x 10 = 50 articles whose IDs are consistent across runs.
 * Each news item has 10 articles to meet the minimum threshold of 8 articles per report.
 */
export function buildTopNewsPayload(country: string, language: string, publishDate: string) {
    return new Array(5).fill(null).map((_, idx) => ({
        news: new Array(10).fill(null).map((__, newsIdx) => ({
            id: (idx + 1) * 1000 + (newsIdx + 1),
            publish_date: publishDate,
            text: `Test article text ${idx}-${newsIdx} for ${country} in ${language}`,
            title: `Test Article ${idx}-${newsIdx} (${country.toUpperCase()}/${language.toUpperCase()})`,
        })),
    }));
}

/**
 * Extracts and returns the relevant query parameters for the WorldNewsAPI top-news endpoint.
 */
export function extractParams(url: string): TopNewsQueryParams {
    const search = new URL(url).searchParams;
    return {
        apiKey: search.get('api-key'),
        date: search.get('date'),
        language: search.get('language'),
        sourceCountry: search.get('source-country'),
    };
}

/**
 * Validates the query parameters shared by both success & empty resolvers.
 */
export function validateParams(params: TopNewsQueryParams): HttpResponse | undefined {
    if (!params.apiKey || !params.date || !params.language || !params.sourceCountry) {
        return new HttpResponse(null, {
            status: 400,
            statusText: 'Invalid query parameters',
        });
    }
    if (params.apiKey !== TEST_API_KEY) {
        return new HttpResponse(null, { status: 403, statusText: 'Invalid test API key' });
    }
    return undefined;
}
