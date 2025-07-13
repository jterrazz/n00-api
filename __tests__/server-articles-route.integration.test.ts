// Simplified integration test focusing on observable behaviour
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { ArticleFactory, ArticleTestScenarios } from './fixtures/article.factory.js';
import {
    cleanupDatabase,
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';
import { normaliseSnapshot } from './setup/snapshot-normaliser.js';

// -----------------------------------------------------------------------------
// /articles route – integration
// -----------------------------------------------------------------------------

describe('Server /articles route – integration', () => {
    let testContext: IntegrationTestContext;

    beforeAll(async () => {
        testContext = await setupIntegrationTest();
    });

    afterAll(async () => {
        await cleanupIntegrationTest(testContext);
    });

    beforeEach(async () => {
        await cleanupDatabase(testContext.prisma);
    });

    // -------------------------------------------------------------------------
    // Content validation (full response & pagination)
    // -------------------------------------------------------------------------

    describe('Content validation', () => {
        /* ------------------------------------------------------------------ */
        /* Shared expected snapshot                                            */
        /* ------------------------------------------------------------------ */
        const expectedSnapshot = {
            items: [
                {
                    authenticity: {
                        reason: 'Fabricated story',
                        status: 'fake',
                    },
                    body: 'Breaking %%[(FAKE)]( sensational ) news about an invented event.',
                    frames: [],
                    headline: 'Invented Event Shocks World',
                    id: '<uuid>',
                    metadata: {
                        category: 'TECHNOLOGY',
                        classification: 'STANDARD',
                        country: 'US',
                        language: 'EN',
                    },
                    publishedAt: '<date>',
                },
                {
                    authenticity: {
                        status: 'authentic',
                    },
                    body: 'Default test article body with detailed information about the topic.',
                    frames: [],
                    headline: 'Default Test Article',
                    id: '<uuid>',
                    metadata: {
                        category: 'TECHNOLOGY',
                        classification: 'STANDARD',
                        country: 'US',
                        language: 'EN',
                    },
                    publishedAt: '<date>',
                },
                {
                    authenticity: {
                        status: 'authentic',
                    },
                    body: 'Default test article body with detailed information about the topic.',
                    frames: [],
                    headline: 'Default Test Article',
                    id: '<uuid>',
                    metadata: {
                        category: 'TECHNOLOGY',
                        classification: 'STANDARD',
                        country: 'US',
                        language: 'EN',
                    },
                    publishedAt: '<date>',
                },
            ],
            nextCursor: null,
            total: 3,
        };

        /* ------------------------------------------------------------------ */
        /* Tests                                                              */
        /* ------------------------------------------------------------------ */

        it('returns full structured JSON response for mixed US articles', async () => {
            // Given – a mixed set of US articles including falsified and authentic ones
            await ArticleTestScenarios.createMixedArticles(testContext.prisma);

            const bodyWithMarkers =
                'Breaking %%[(FAKE)]( sensational )%% news about an invented event.';

            await new ArticleFactory()
                .withHeadline('Invented Event Shocks World')
                .withBody(bodyWithMarkers)
                .withPublishedAt(new Date('2024-03-03T12:00:00.000Z'))
                .asFake('Fabricated story')
                .createInDatabase(testContext.prisma);

            // When – request all articles
            const res = await testContext.gateways.httpServer.request('/articles?limit=10');
            const response = await res.json();

            // Then – status is OK
            expect(res.status).toBe(200);

            const snapshot = normaliseSnapshot(response);

            expect(snapshot).toStrictEqual(expectedSnapshot);
        });

        it('returns the same structured JSON response when paginated', async () => {
            // Given – the same mixed set of articles in the database
            await ArticleTestScenarios.createMixedArticles(testContext.prisma);

            const bodyWithMarkers =
                'Breaking %%[(FAKE)]( sensational )%% news about an invented event.';

            await new ArticleFactory()
                .withHeadline('Invented Event Shocks World')
                .withBody(bodyWithMarkers)
                .withPublishedAt(new Date('2024-03-03T12:00:00.000Z'))
                .asFake('Fabricated story')
                .createInDatabase(testContext.prisma);

            // When – first page request (limit 2)
            const firstRes = await testContext.gateways.httpServer.request('/articles?limit=2');
            const firstBody = await firstRes.json();

            // Then – first page OK and contains 2 items
            expect(firstRes.status).toBe(200);
            expect(firstBody.items).toHaveLength(2);
            expect(firstBody.nextCursor).toBeDefined();

            // When – second page using cursor (limit 2)
            const secondRes = await testContext.gateways.httpServer.request(
                `/articles?limit=2&cursor=${firstBody.nextCursor}`,
            );
            const secondBody = await secondRes.json();

            // Then – second page OK
            expect(secondRes.status).toBe(200);

            // Combine both pages to validate the full dataset
            const combinedResponse = {
                ...secondBody,
                items: [...firstBody.items, ...secondBody.items],
                nextCursor: secondBody.nextCursor, // should be null on the last page
            } as const;

            const snapshot = normaliseSnapshot(combinedResponse);

            expect(snapshot).toStrictEqual(expectedSnapshot);
        });
    });
});
