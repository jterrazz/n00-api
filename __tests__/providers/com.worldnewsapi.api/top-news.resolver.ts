import { http, HttpResponse } from 'msw';

import { createTZDateForCountry, formatTZDateForCountry } from '../../../src/shared/date/timezone.js';

import {
    buildTopNewsPayload,
    extractParams,
    validateParams,
} from './top-news.utils.js';


/**
 * Mock handler for the World News API top news endpoint.
 * Returns test article data for different country-language combinations used by the article generation task.
 */
export const worldNewsResolver = http.get(
    'https://api.worldnewsapi.com/top-news',
    ({ request }) => {
        const params = extractParams(request.url);

        const validationError = validateParams(params);
        if (validationError) return validationError;

        // Format the publish date in the correct timezone for the source country
        const publishDate = formatTZDateForCountry(
            createTZDateForCountry(new Date(`${params.date}T12:00:00Z`), params.sourceCountry!),
            params.sourceCountry!,
            "yyyy-MM-dd'T'HH:mm:ssXXX",
        );

        const response = {
            country: params.sourceCountry!,
            language: params.language!,
            top_news: buildTopNewsPayload(params.sourceCountry!, params.language!, publishDate),
        };

        return HttpResponse.json(response);
    },
);
