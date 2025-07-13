import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { worldNewsEmptyResolver } from './providers/com.worldnewsapi.api/top-news-empty.resolver.js';
import {
    cleanupDatabase,
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';

/**
 * Integration tests for the Report Pipeline task.
 * Scenario: No articles are returned by external news providers, so the pipeline does nothing.
 */

describe('Worker – report-pipeline task (empty news) – integration', () => {
    let testContext: IntegrationTestContext;

    // --------------------
    // Setup & Teardown
    // --------------------

    beforeAll(async () => {
        // Start test environment with MSW resolver that returns an empty payload.
        testContext = await setupIntegrationTest([worldNewsEmptyResolver]);
    });

    beforeEach(async () => {
        // Ensure a clean database state before every test.
        await cleanupDatabase(testContext.prisma);
        await testContext.prisma.report.deleteMany();
    });

    afterAll(async () => {
        await cleanupIntegrationTest(testContext);
    });

    // --------------------
    // Test cases
    // --------------------

    describe('No articles found on sources', () => {
        it('should not create any reports or articles', async () => {
            // Given - the report-pipeline task is registered in the container
            const reportPipelineTask = testContext.gateways.tasks.find(
                (task) => task.name === 'report-pipeline',
            );

            expect(reportPipelineTask).toBeDefined();

            // When - executing the pipeline
            await reportPipelineTask!.execute();

            // Then - nothing should be persisted
            const articleCount = await testContext.prisma.article.count();
            const reportCount = await testContext.prisma.report.count();

            expect(articleCount).toBe(0);
            expect(reportCount).toBe(0);
        });
    });
});
