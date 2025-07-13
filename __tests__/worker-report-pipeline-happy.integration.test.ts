import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { ArticleFactory } from './fixtures/article.factory.js';
import { openRouterUniversalResolver } from './providers/ai.openrouter/open-router-universal.resolver.js';
import { worldNewsResolver } from './providers/com.worldnewsapi.api/top-news.resolver.js';
import {
    cleanupDatabase,
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';

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

    describe('Happy path with available news reports', () => {
        it('should ingest reports, classify them, and generate articles accordingly', async () => {
            // Given
            const reportPipelineTask = testContext.gateways.tasks.find(
                (task) => task.name === 'report-pipeline',
            );
            expect(reportPipelineTask).toBeDefined();

            // When – execute the pipeline
            await reportPipelineTask!.execute();

            // Then – Verify reports presence and correct classifications
            const reports = await testContext.prisma.report.findMany({
                orderBy: { createdAt: 'asc' },
            });
            expect(reports.length).toBeGreaterThanOrEqual(4); // Two languages processed

            const classifications = new Set(reports.map((r) => r.classification));
            expect(classifications.has('STANDARD')).toBe(true);
            expect(classifications.has('NICHE')).toBe(true);
            expect(classifications.has('ARCHIVED')).toBe(true);

            // Articles should be generated for each STANDARD and NICHE report
            const articles = await testContext.prisma.article.findMany();
            expect(articles.length).toBeGreaterThanOrEqual(2);

            // Ensure each article is linked to at least one report id
            for (const article of articles) {
                const links = (await testContext.prisma
                    .$queryRaw`SELECT COUNT(*) as cnt FROM _ReportArticles WHERE A = ${article.id}`) as Array<{
                    cnt: bigint | number;
                }>;
                const linkCount = links.length > 0 ? Number(links[0].cnt) : 0;
                expect(linkCount).toBeGreaterThanOrEqual(1);
            }
        });

        it('should generate at least one fake article for educational gameplay', async () => {
            // Given
            // Create one authentic article so the fake-generation ratio deems a fake necessary.
            await new ArticleFactory().asReal().createInDatabase(testContext.prisma);

            const reportPipelineTask = testContext.gateways.tasks.find(
                (task) => task.name === 'report-pipeline',
            );

            // Execute the pipeline again to ensure articles exist and fake generation logic runs
            await reportPipelineTask!.execute();

            // When – fetch articles
            const articles = await testContext.prisma.article.findMany();

            // Then – verify at least one falsified article exists
            const hasFake = articles.some((a) => a.authenticity === 'FALSIFIED');
            expect(hasFake).toBe(true);
        });
    });
});
