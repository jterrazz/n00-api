import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, mockOf, test } from '@jterrazz/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { vi } from 'vitest';
import { type Mock } from 'vitest';

// Application
import {
    type NewsProviderPort,
    type NewsReport,
} from '../../../../application/ports/outbound/providers/news.port.js';

// Domain
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import { CachedNews } from '../cached-news.provider.js';

// Mock node fs operations
vi.mock('node:fs');

describe('CachedNews', () => {
    // Given
    const mockNewsSource = mockOf<NewsProviderPort>();
    const mockLogger = mockOf<LoggerPort>();
    const cacheDirectory = 'test';

    const options = {
        country: new Country('US'),
        language: new Language('EN'),
    };

    const mockReport: NewsReport = {
        articles: [
            {
                body: 'Test summary',
                headline: 'Test title',
                id: 'test-article-1',
            },
        ],
        publishedAt: new Date('2024-03-08T00:00:00.000Z'),
    };

    let provider: CachedNews;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new CachedNews(mockNewsSource, mockLogger, cacheDirectory);
    });

    describe('fetchNews', () => {
        test('should return cached data when valid cache exists', async () => {
            // Given - a valid cache exists for the requested data
            const validCache = {
                data: [mockReport],
                timestamp: Date.now(),
            };
            (existsSync as Mock).mockReturnValue(true);
            (readFileSync as Mock).mockReturnValue(JSON.stringify(validCache));

            // When - fetching data from the provider
            const result = await provider.fetchNews(options);

            // Then - it should return the cached data
            expect(result).toEqual([mockReport]);
            expect(mockNewsSource.fetchNews).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Cache hit', {
                ageMs: expect.any(Number),
                language: 'EN',
                reportCount: 1,
            });
        });

        test('should fetch fresh data when cache is expired', async () => {
            // Given - a cache that is expired (older than allowed)
            const expiredCache = {
                data: [mockReport],
                timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours old
            };
            (existsSync as Mock).mockReturnValue(true);
            (readFileSync as Mock).mockReturnValue(JSON.stringify(expiredCache));
            mockNewsSource.fetchNews.mockResolvedValue([mockReport]);

            // When - fetching data from the provider
            const result = await provider.fetchNews(options);

            // Then - it should fetch fresh data and update the cache
            expect(result).toEqual([mockReport]);
            expect(mockNewsSource.fetchNews).toHaveBeenCalledWith(options);
            expect(mockLogger.info).toHaveBeenCalledWith('Cache expired, removing file', {
                language: 'EN',
                path: expect.stringContaining(`${cacheDirectory}/reports/EN.json`),
            });
            expect(writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining(`${cacheDirectory}/reports/EN.json`),
                expect.any(String),
            );
        });

        test('should fetch fresh data when cache does not exist', async () => {
            // Given - no cache exists for the requested data
            (existsSync as Mock).mockReturnValue(false);
            mockNewsSource.fetchNews.mockResolvedValue([mockReport]);

            // When - fetching data from the provider
            const result = await provider.fetchNews(options);

            // Then - it should fetch fresh data and return it
            expect(result).toEqual([mockReport]);
            expect(mockNewsSource.fetchNews).toHaveBeenCalledWith(options);
            expect(mockLogger.info).toHaveBeenCalledWith('Cache miss', {
                language: 'EN',
            });
        });

        describe('error handling', () => {
            test('should fallback to fresh data when cache read fails', async () => {
                // Given - reading the cache throws an error
                (existsSync as Mock).mockReturnValue(true);
                (readFileSync as Mock).mockImplementation(() => {
                    throw new Error('Read error');
                });
                mockNewsSource.fetchNews.mockResolvedValue([mockReport]);

                // When - fetching data from the provider
                const result = await provider.fetchNews(options);

                // Then - it should fetch fresh data and log the cache read error
                expect(result).toEqual([mockReport]);
                expect(mockLogger.error).toHaveBeenCalledWith('Error reading cache', {
                    error: expect.any(Error),
                    language: 'EN',
                    path: expect.stringContaining(`${cacheDirectory}/reports/EN.json`),
                });
                expect(mockNewsSource.fetchNews).toHaveBeenCalledWith(options);
            });

            test('should return data even when cache write fails', async () => {
                // Given - writing to the cache throws an error
                (existsSync as Mock).mockReturnValue(false);
                (writeFileSync as Mock).mockImplementation(() => {
                    throw new Error('Write error');
                });
                mockNewsSource.fetchNews.mockResolvedValue([mockReport]);

                // When - fetching data from the provider
                const result = await provider.fetchNews(options);

                // Then - it should return the data and log the cache write error
                expect(result).toEqual([mockReport]);
                expect(mockLogger.error).toHaveBeenCalledWith('Error writing cache file', {
                    error: expect.any(Error),
                    language: 'EN',
                });
            });
        });
    });
});
