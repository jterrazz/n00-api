import { type LoggerPort } from '@jterrazz/logger';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { z } from 'zod/v4';

import {
    type NewsOptions,
    type NewsProviderPort,
    type NewsReport,
} from '../../../application/ports/outbound/providers/news.port.js';

// Constants
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const DEFAULT_LANGUAGE = 'en';
const CACHE_FILE_ENCODING = 'utf-8';
const JSON_INDENT = 2;

// Helper functions
const getCacheDir = (env: string) => `${tmpdir()}/fake-news/${env}`;
const getCachePath = (env: string, lang: string) => `${getCacheDir(env)}/reports/${lang}.json`;

// Types
type CacheData = z.infer<typeof cacheDataSchema>;

// Schemas
const newsArticleSchema = z.object({
    body: z.string(),
    headline: z.string(),
    id: z.string(),
});

const newsReportSchema = z.object({
    articles: z.array(newsArticleSchema),
    publishedAt: z.iso.datetime().transform((date) => new Date(date)),
});

const cacheDataSchema = z.object({
    data: z.array(newsReportSchema),
    timestamp: z.number(),
});

/**
 * Decorator that adds caching behavior to any news data source
 */
export class CachedNews implements NewsProviderPort {
    constructor(
        private readonly newsSource: NewsProviderPort,
        private readonly logger: LoggerPort,
        private readonly cacheDirectory: string,
    ) {
        const cacheDir = getCacheDir(this.cacheDirectory);
        this.logger.info('Initializing CachedNews provider', {
            directory: cacheDir,
            environment: this.cacheDirectory,
            ttlMs: CACHE_TTL,
        });
    }

    /**
     * Clear all cached data for debugging purposes
     */
    public clearAllCache(): void {
        try {
            const cacheDir = getCacheDir(this.cacheDirectory);
            if (existsSync(cacheDir)) {
                rmSync(cacheDir, { force: true, recursive: true });
                this.logger.info('Cache cleared', { directory: cacheDir });
            }
        } catch (error) {
            this.logger.error('Error while clearing cache', { error });
        }
    }

    public async fetchNews(options?: NewsOptions): Promise<NewsReport[]> {
        const language = options?.language?.toString() ?? DEFAULT_LANGUAGE;

        this.logger.debug('Checking cache', { language });

        const cachedData = this.readCache(language);
        if (cachedData) {
            this.logger.info('Cache hit', {
                ageMs: Date.now() - cachedData.timestamp,
                language,
                reportCount: cachedData.data.length,
            });
            return cachedData.data;
        }

        this.logger.info('Cache miss', { language });
        const stories = await this.newsSource.fetchNews(options);

        this.logger.debug('Writing to cache', {
            language,
            reportCount: stories.length,
        });
        this.writeCache(stories, language);

        return stories;
    }

    private ensureDirectoryExists(filePath: string): void {
        const directory = dirname(filePath);
        if (!existsSync(directory)) {
            mkdirSync(directory, { recursive: true });
        }
    }

    private isCacheExpired(timestamp: number): boolean {
        return Date.now() - timestamp > CACHE_TTL;
    }

    private readCache(language: string): CacheData | null {
        try {
            const cachePath = getCachePath(this.cacheDirectory, language);

            if (!existsSync(cachePath)) {
                return null;
            }

            const cacheContent = readFileSync(cachePath, CACHE_FILE_ENCODING);

            // Check if file is empty or contains invalid JSON
            if (!cacheContent.trim()) {
                this.logger.warn('Cache file empty, removing', { language, path: cachePath });
                this.removeCache(cachePath);
                return null;
            }

            const parsedCache = JSON.parse(cacheContent);
            const cache = cacheDataSchema.parse(parsedCache);

            if (this.isCacheExpired(cache.timestamp)) {
                this.logger.info('Cache expired, removing file', { language, path: cachePath });
                this.removeCache(cachePath);
                return null;
            }

            return cache;
        } catch (error) {
            const cachePath = getCachePath(this.cacheDirectory, language);
            this.logger.error('Error reading cache', {
                error,
                language,
                path: cachePath,
            });
            this.removeCache(cachePath);
            return null;
        }
    }

    private removeCache(cachePath: string): void {
        try {
            if (existsSync(cachePath)) {
                unlinkSync(cachePath);
            }
        } catch (error) {
            this.logger.error('Error removing cache file', { error, path: cachePath });
        }
    }

    private writeCache(data: NewsReport[], language: string): void {
        try {
            const cachePath = getCachePath(this.cacheDirectory, language);
            this.ensureDirectoryExists(cachePath);

            const cacheData: CacheData = {
                data,
                timestamp: Date.now(),
            };

            writeFileSync(cachePath, JSON.stringify(cacheData, null, JSON_INDENT));

            this.logger.info('Cache file written', {
                language,
                path: cachePath,
                reportCount: data.length,
                size: JSON.stringify(cacheData).length,
            });
        } catch (error) {
            this.logger.error('Error writing cache file', { error, language });
        }
    }
}
