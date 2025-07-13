import { http, HttpResponse } from 'msw';

import { extractParams, validateParams } from './top-news.utils.js';

/**
 * Mock handler for the World News API top news endpoint.
 * Returns an empty list to simulate no articles found for the given parameters.
 */
export const worldNewsEmptyResolver = http.get(
    'https://api.worldnewsapi.com/top-news',
    ({ request }) => {
        const params = extractParams(request.url);

        const validationError = validateParams(params);
        if (validationError) return validationError;

        const emptyResponse = {
            country: params.sourceCountry,
            language: params.language,
            top_news: [],
        };

        return HttpResponse.json(emptyResponse);
    },
); 