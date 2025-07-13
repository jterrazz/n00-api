import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { ArticleTestScenarios } from './fixtures/article.factory.js';
import {
    createIntegrationContext,
    executeRequest,
    type IntegrationContext,
    startIntegrationContext,
    stopIntegrationContext,
} from './setup/integration.js';
import { normaliseSnapshot } from './setup/snapshot-normaliser.js';

/**
 * Integration tests for the /articles server route.
 * Scenario: Mixed set of articles with different authenticity statuses.
 */
describe('Server /articles route – integration', () => {
    let integrationContext: IntegrationContext;

    beforeAll(async () => {
        integrationContext = await createIntegrationContext();
    });

    beforeEach(async () => {
        await startIntegrationContext(integrationContext);
    });

    afterEach(async () => {
        await stopIntegrationContext(integrationContext);
    });

    describe('Content validation', () => {
        const expectedSnapshot = {
            items: [
                {
                    authenticity: {
                        clarification: 'Fabricated story',
                        status: 'fabricated',
                    },
                    body: 'Breaking %%[(FABRICATED)]( sensational ) news about an invented event.',
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

        it('returns full structured JSON response for mixed US articles', async () => {
            // Given – a mixed set of US articles including fabricated and authentic ones
            await ArticleTestScenarios.createMixedArticles(integrationContext.prisma);
            await ArticleTestScenarios.createFabricatedInventedEventArticle(
                integrationContext.prisma,
            );

            // When – request all articles
            const res = await executeRequest(integrationContext, '/articles?limit=10');
            const response = await res.json();

            // Then – status is OK
            expect(res.status).toBe(200);

            const snapshot = normaliseSnapshot(response);

            expect(snapshot).toStrictEqual(expectedSnapshot);
        });

        it('returns the same structured JSON response when paginated', async () => {
            // Given – the same mixed set of articles in the database
            await ArticleTestScenarios.createMixedArticles(integrationContext.prisma);
            await ArticleTestScenarios.createFabricatedInventedEventArticle(
                integrationContext.prisma,
            );

            // When – first page request (limit 2)
            const firstRes = await executeRequest(integrationContext, '/articles?limit=2');
            const firstBody = await firstRes.json();

            // Then – first page OK and contains 2 items
            expect(firstRes.status).toBe(200);
            expect(firstBody.items).toHaveLength(2);
            expect(firstBody.nextCursor).toBeDefined();

            // When – second page using cursor (limit 2)
            const secondRes = await executeRequest(
                integrationContext,
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
