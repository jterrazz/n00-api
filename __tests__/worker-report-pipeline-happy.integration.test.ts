import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { openRouterUniversalResolver } from './providers/ai.openrouter/open-router-universal.resolver.js';
import { worldNewsResolver } from './providers/com.worldnewsapi.api/top-news.resolver.js';
import {
    cleanupDatabase,
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';
import { normaliseSnapshot } from './setup/snapshot-normaliser.js';

/**
 * Integration tests for the Report Pipeline task.
 * Scenario: News provider returns reports, AI agents ingest, classify, and compose articles.
 */

describe('Worker – report-pipeline task (happy path) – integration', () => {
    let testContext: IntegrationTestContext;

    // --------------------
    // Setup & Teardown
    // --------------------

    beforeAll(async () => {
        testContext = await setupIntegrationTest([worldNewsResolver, openRouterUniversalResolver]);
    });

    beforeEach(async () => {
        // Clean database and reset classification counter.
        await cleanupDatabase(testContext.prisma);
        await testContext.prisma.report.deleteMany();
    });

    afterAll(async () => {
        await cleanupIntegrationTest(testContext);
    });

    // --------------------
    // Test cases
    // --------------------

    it('creates well-structured articles with mixed authenticity', async () => {
        // When – run pipeline
        const pipelineTask = testContext.gateways.tasks.find((t) => t.name === 'report-pipeline');
        expect(pipelineTask).toBeDefined();
        await pipelineTask!.execute();

        // Then – fetch reports & articles with relations for deeper validation
        const reports = await testContext.prisma.report.findMany({ include: { angles: true } });
        const articles = await testContext.prisma.article.findMany({
            include: { frames: true, reports: true },
        });

        // Basic expectations
        expect(reports.length).toBeGreaterThan(0);
        expect(articles.length).toBeGreaterThan(0);

        /* ------------------------------------------------------------------ */
        /* Strict JSON snapshot comparison with normalised dynamic fields      */
        /* ------------------------------------------------------------------ */

        const SOURCE_RE = /^worldnewsapi:/;

        const snapshot = normaliseSnapshot(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (JSON.parse(JSON.stringify(articles)) as any[]).sort(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (a: any, b: any) => {
                    return (
                        a.country.localeCompare(b.country) ||
                        a.language.localeCompare(b.language) ||
                        a.authenticity.localeCompare(b.authenticity) ||
                        a.reports[0].classification.localeCompare(b.reports[0].classification)
                    );
                },
            ),
            [[SOURCE_RE, '<source>']],
        );

        const authTemplate = (country: 'FR' | 'US', classification: 'NICHE' | 'STANDARD') => ({
            authenticity: 'AUTHENTIC',
            body: 'Neutral summary of the core, undisputed facts of the event.',
            category: 'TECHNOLOGY',
            country,
            createdAt: '<date>',
            falsificationReason: null,
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
        const comparator = (a: any, b: any) => {
            return (
                a.country.localeCompare(b.country) ||
                a.language.localeCompare(b.language) ||
                a.authenticity.localeCompare(b.authenticity) ||
                (a.reports[0]?.classification ?? '').localeCompare(
                    b.reports[0]?.classification ?? '',
                )
            );
        };

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
                country: 'FR',
                createdAt: '<date>',
                falsificationReason: 'Unrealistic scientific claims with no evidence',
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
                country: 'US',
                createdAt: '<date>',
                falsificationReason: 'Unrealistic scientific claims with no evidence',
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
