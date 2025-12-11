import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    ArticleFactory,
    createFabricatedInventedEventArticle,
    createMixedArticles,
} from './fixtures/article.factory.js';
import {
    cleanupIntegrationContext,
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

    afterAll(async () => {
        await cleanupIntegrationContext(integrationContext);
    });

    describe('Fetch by IDs', () => {
        it('returns only requested articles in the same order as ids', async () => {
            // Given – seed articles
            await createMixedArticles(integrationContext.prisma);

            const all = await integrationContext.prisma.article.findMany({
                orderBy: { createdAt: 'asc' },
                select: { id: true },
            });
            const ids = [all[1].id, all[0].id];

            // When – query with ids param (multi-valued)
            const res = await executeRequest(
                integrationContext,
                `/articles?ids=${encodeURIComponent(ids[0])}&ids=${encodeURIComponent(ids[1])}`,
            );
            const body = await res.json();

            // Then
            expect(res.status).toBe(200);
            expect(body.items).toHaveLength(2);
            expect(body.items.map((i: { id: string }) => i.id)).toEqual(ids);
            expect(body.total).toBe(2);
            expect(body.nextCursor).toBeNull();
        });
    });

    beforeEach(async () => {
        await startIntegrationContext(integrationContext);
    });

    afterEach(async () => {
        await stopIntegrationContext(integrationContext);
    });

    describe('Content validation', () => {
        const expectedItemShape = expect.objectContaining({
            body: expect.any(String),
            challenges: expect.objectContaining({
                authenticity: expect.objectContaining({
                    enable: expect.any(Boolean),
                    explanation: expect.any(String),
                }),
                quiz: expect.objectContaining({
                    enable: expect.any(Boolean),
                    questions: expect.any(Array),
                }),
            }),
            frames: expect.any(Array),
            headline: expect.any(String),
            id: expect.any(String),
            insights: expect.any(Array),
            metadata: expect.objectContaining({
                categories: expect.any(Array),
                country: expect.any(String),
                fabricated: expect.any(Boolean),
                language: expect.any(String),
                traits: expect.any(Object),
            }),
            publishedAt: expect.any(String),
        });

        it('returns full structured JSON response for mixed US articles', async () => {
            // Given – a mixed set of US articles including fabricated and authentic ones
            await createMixedArticles(integrationContext.prisma);
            await createFabricatedInventedEventArticle(integrationContext.prisma);

            // When – request all articles
            const res = await executeRequest(integrationContext, '/articles?limit=10');
            const response = await res.json();

            // Then – status is OK
            expect(res.status).toBe(200);

            // Basic structural checks
            expect(response).toEqual(
                expect.objectContaining({
                    items: expect.any(Array),
                    nextCursor: null,
                    total: expect.any(Number),
                }),
            );
            expect(response.items.length).toBeGreaterThanOrEqual(2);
            expect(response.total).toBeGreaterThanOrEqual(2);
            for (const item of response.items) {
                expect(item).toEqual(expectedItemShape);
            }

            // Exact snapshot (normalized for UUIDs and dates)
            const normalized = normaliseSnapshot(response);
            expect(normalized).toEqual({
                items: [
                    {
                        body: 'Breaking %%[(FABRICATED)]( sensational ) news about an invented event.',
                        challenges: {
                            authenticity: { enable: true, explanation: 'Fabricated story' },
                            quiz: { enable: false, questions: [] },
                        },
                        frames: [],
                        headline: 'Invented Event Shocks World',
                        id: '<uuid>',
                        insights: [],
                        metadata: {
                            categories: ['TECHNOLOGY'],
                            country: 'US',
                            fabricated: true,
                            language: 'EN',
                            tier: 'GENERAL',
                            traits: { essential: false, positive: false },
                        },
                        publishedAt: '<date>',
                    },
                    {
                        body: 'Default test article body with detailed information about the topic.',
                        challenges: {
                            authenticity: { enable: false, explanation: '' },
                            quiz: { enable: false, questions: [] },
                        },
                        frames: [],
                        headline: 'Default Test Article',
                        id: '<uuid>',
                        insights: [],
                        metadata: {
                            categories: ['TECHNOLOGY'],
                            country: 'US',
                            fabricated: false,
                            language: 'EN',
                            tier: 'GENERAL',
                            traits: { essential: false, positive: false },
                        },
                        publishedAt: '<date>',
                    },
                    {
                        body: 'Default test article body with detailed information about the topic.',
                        challenges: {
                            authenticity: { enable: false, explanation: '' },
                            quiz: { enable: false, questions: [] },
                        },
                        frames: [],
                        headline: 'Default Test Article',
                        id: '<uuid>',
                        insights: [],
                        metadata: {
                            categories: ['TECHNOLOGY'],
                            country: 'US',
                            fabricated: false,
                            language: 'EN',
                            tier: 'GENERAL',
                            traits: { essential: false, positive: false },
                        },
                        publishedAt: '<date>',
                    },
                ],
                nextCursor: null,
                total: 3,
            });
        });

        it('returns the same structured JSON response when paginated', async () => {
            // Given – the same mixed set of articles in the database
            await createMixedArticles(integrationContext.prisma);
            await createFabricatedInventedEventArticle(integrationContext.prisma);
            // Ensure there are strictly more than 2 US articles so we always have a next page
            await new ArticleFactory()
                .withCountry('US')
                .withLanguage('EN')
                .withId('44444444-4444-4444-8444-444444444444')
                .withPublishedAt(new Date('2024-03-04T12:00:00.000Z'))
                .createInDatabase(integrationContext.prisma);

            // When – first page request (limit 1) to guarantee a next page
            const firstRes = await executeRequest(integrationContext, '/articles?limit=1');
            const firstBody = await firstRes.json();

            // Then – first page OK and contains 1 item
            expect(firstRes.status).toBe(200);
            expect(firstBody.items).toHaveLength(1);
            expect(firstBody.nextCursor).toBeDefined();

            // When – second page using cursor (limit 2)
            const lastItemFromFirstPage = firstBody.items[firstBody.items.length - 1];
            const manualCursor = Buffer.from(
                new Date(lastItemFromFirstPage.publishedAt).getTime().toString(),
            ).toString('base64');
            const secondRes = await executeRequest(
                integrationContext,
                `/articles?limit=2&cursor=${encodeURIComponent(manualCursor)}`,
            );
            const secondBody = await secondRes.json();

            // Then – always expect a second page for this dataset
            expect(secondRes.status).toBe(200);
            expect(Array.isArray(secondBody.items)).toBe(true);
            expect(secondBody.items.length).toBeGreaterThanOrEqual(1);

            const combined = [...firstBody.items, ...secondBody.items];
            expect(combined.length).toBeGreaterThanOrEqual(2);
            for (const item of combined) {
                expect(item).toEqual(expectedItemShape);
            }
        });
    });
});
