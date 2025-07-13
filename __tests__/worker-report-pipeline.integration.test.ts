import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { openRouterUniversalResolver } from './providers/ai.openrouter/open-router-universal.resolver.js';
import { worldNewsResolver } from './providers/com.worldnewsapi.api/top-news.resolver.js';
import { worldNewsEmptyResolver } from './providers/com.worldnewsapi.api/top-news-empty.resolver.js';
import {
    createIntegrationContext,
    executeTask,
    type IntegrationContext,
    startIntegrationContext,
    stopIntegrationContext,
} from './setup/integration.js';
import { normaliseSnapshot } from './setup/snapshot-normaliser.js';

/**
 * Integration tests for the Report Pipeline task.
 * Combines scenarios for empty news and happy path into a single file.
 */

// Empty news scenario
describe('Worker – report-pipeline task (empty news) – integration', () => {
    let integrationContext: IntegrationContext;

    beforeAll(async () => {
        integrationContext = await createIntegrationContext([worldNewsEmptyResolver]);
    });

    beforeEach(async () => {
        await startIntegrationContext(integrationContext);
    });

    afterEach(async () => {
        await stopIntegrationContext(integrationContext);
    });

    describe('No articles found on sources', () => {
        it('should not create any reports or articles', async () => {
            // When – executing the pipeline
            await executeTask(integrationContext, 'report-pipeline');

            // Then – nothing should be persisted
            const articleCount = await integrationContext.prisma.article.count();
            const reportCount = await integrationContext.prisma.report.count();

            expect(articleCount).toBe(0);
            expect(reportCount).toBe(0);
        });
    });
});

// Happy path scenario
describe('Worker – report-pipeline task (happy path) – integration', () => {
    let integrationContext: IntegrationContext;

    beforeAll(async () => {
        integrationContext = await createIntegrationContext([
            worldNewsResolver,
            openRouterUniversalResolver,
        ]);
    });

    beforeEach(async () => {
        await startIntegrationContext(integrationContext);
    });

    afterEach(async () => {
        await stopIntegrationContext(integrationContext);
    });

    it('creates well-structured articles with mixed authenticity', async () => {
        // When – run pipeline
        await executeTask(integrationContext, 'report-pipeline');

        // Then – fetch reports & articles with relations for deeper validation
        const reports = await integrationContext.prisma.report.findMany({
            include: { angles: true },
        });
        const articles = await integrationContext.prisma.article.findMany({
            include: { frames: true, reports: true },
        });

        // Basic expectations
        expect(reports.length).toBeGreaterThan(0);
        expect(articles.length).toBeGreaterThan(0);

        const SOURCE_RE = /^worldnewsapi:/;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comparator = (a: any, b: any) => {
            const aClass = a.reports[0]?.classification ?? '';
            const bClass = b.reports[0]?.classification ?? '';
            return (
                a.country.localeCompare(b.country) ||
                a.language.localeCompare(b.language) ||
                a.authenticity.localeCompare(b.authenticity) ||
                aClass.localeCompare(bClass)
            );
        };

        const snapshot = normaliseSnapshot(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (JSON.parse(JSON.stringify(articles)) as any[]).sort(comparator),
            [[SOURCE_RE, '<source>']],
        );

        const authTemplate = (country: 'FR' | 'US', classification: 'NICHE' | 'STANDARD') => ({
            authenticity: 'AUTHENTIC',
            body: 'Neutral summary of the core, undisputed facts of the event.',
            category: 'TECHNOLOGY',
            clarification: null,
            country,
            createdAt: '<date>',
            frames: [
                {
                    articleId: '<uuid>',
                    body: 'Perspective specific frame content for the angle.',
                    createdAt: '<date>',
                    discourse: 'MAINSTREAM',
                    headline: 'Angle headline',
                    id: '<uuid>',
                    stance: 'NEUTRAL',
                },
            ],
            headline: 'Main headline for the article',
            id: '<uuid>',
            language: country === 'US' ? 'EN' : 'FR',
            publishedAt: '<date>',
            reports: [
                {
                    category: 'TECHNOLOGY',
                    classification,
                    country,
                    createdAt: '<date>',
                    dateline: '<date>',
                    facts: 'Verified facts about the event presented in a clear, objective manner.',
                    id: '<uuid>',
                    sources: ['<source>', '<source>', '<source>', '<source>', '<source>'],
                    updatedAt: '<date>',
                },
            ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expectedSnapshot: any[] = [
            authTemplate('FR', 'NICHE'),
            authTemplate('FR', 'STANDARD'),
            authTemplate('US', 'NICHE'),
            authTemplate('US', 'STANDARD'),
            {
                authenticity: 'FALSIFIED',
                body: 'Satirical article body exaggerating the discovery of unicorn fossil fuels capable of infinite clean energy, clearly fictional.',
                category: 'TECHNOLOGY',
                clarification: 'Unrealistic scientific claims with no evidence',
                country: 'FR',
                createdAt: '<date>',
                frames: [],
                headline: 'Scientists Harness Unicorn Fossil Fuel for Endless Clean Energy',
                id: '<uuid>',
                language: 'FR',
                publishedAt: '<date>',
                reports: [],
            },
            {
                authenticity: 'FALSIFIED',
                body: 'Satirical article body exaggerating the discovery of unicorn fossil fuels capable of infinite clean energy, clearly fictional.',
                category: 'TECHNOLOGY',
                clarification: 'Unrealistic scientific claims with no evidence',
                country: 'US',
                createdAt: '<date>',
                frames: [],
                headline: 'Scientists Harness Unicorn Fossil Fuel for Endless Clean Energy',
                id: '<uuid>',
                language: 'EN',
                publishedAt: '<date>',
                reports: [],
            },
        ].sort(comparator);

        expect(snapshot).toStrictEqual(expectedSnapshot);
    });
});
