import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jterrazz/test';

import { ArticleFactory, ArticleTestScenarios } from './fixtures/article.factory.js';
import {
    cleanupDatabase,
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';

describe('Server /articles route – integration', () => {
    let testContext: IntegrationTestContext;

    beforeAll(async () => {
        testContext = await setupIntegrationTest();
    });

    beforeEach(async () => {
        await cleanupDatabase(testContext.prisma);
    });

    afterAll(async () => {
        await cleanupIntegrationTest(testContext);
    });

    describe('Successful requests', () => {
        it('should return paginated articles with default parameters', async () => {
            // Given
            const { usArticles } = await ArticleTestScenarios.createMixedArticles(
                testContext.prisma,
            );

            // When
            const response = await testContext.gateways.httpServer.request('/articles');
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(usArticles.length);
            expect(data.total).toBe(usArticles.length);
            expect(data.nextCursor).toBeNull();

            // Verify default filtering (US articles in English)
            data.items.forEach((item) => {
                expect(item.metadata.country).toBe('US');
                expect(item.metadata.language).toBe('EN');
            });

            // Verify ordering (newest first)
            const dates = data.items.map((item) => new Date(item.publishedAt));
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
            }
        });

        it('should filter articles by category and country', async () => {
            // Given
            await ArticleTestScenarios.createMixedArticles(testContext.prisma);

            // When
            const response = await testContext.gateways.httpServer.request(
                '/articles?category=TECHNOLOGY&country=FR&language=FR',
            );
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(1);
            expect(data.items[0].metadata).toMatchObject({
                category: 'TECHNOLOGY',
                country: 'FR',
                language: 'FR',
            });
            expect(data.total).toBe(1);
        });

        it('should handle pagination correctly', async () => {
            // Given
            await new ArticleFactory()
                .withCountry('US')
                .createManyInDatabase(testContext.prisma, 5);

            // When - first page
            const firstResponse =
                await testContext.gateways.httpServer.request('/articles?limit=2');
            const firstData = await firstResponse.json();

            // Then
            expect(firstResponse.status).toBe(200);
            expect(firstData.items).toHaveLength(2);
            expect(firstData.total).toBe(5);
            expect(firstData.nextCursor).toBeDefined();

            // When - second page
            const secondResponse = await testContext.gateways.httpServer.request(
                `/articles?limit=2&cursor=${firstData.nextCursor}`,
            );
            const secondData = await secondResponse.json();

            // Then - verify no duplicates between pages
            expect(secondResponse.status).toBe(200);
            expect(secondData.items).toHaveLength(2);

            const firstPageIds = new Set(firstData.items.map((item) => item.id));
            const secondPageIds = new Set(secondData.items.map((item) => item.id));
            const hasOverlap = [...secondPageIds].some((id) => firstPageIds.has(id));
            expect(hasOverlap).toBe(false);
        });

        it('should handle empty results gracefully', async () => {
            // Given
            await ArticleTestScenarios.createEmptyResultScenario(testContext.prisma);

            // When
            const response = await testContext.gateways.httpServer.request(
                '/articles?category=entertainment',
            );
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toEqual([]);
            expect(data.total).toBe(0);
            expect(data.nextCursor).toBeNull();
        });

        it('should return complete article structure with frames schema', async () => {
            // Given
            const testBody =
                'Scientists at leading universities have announced a %%[(REVOLUTIONARY)]( groundbreaking advancement in artificial intelligence.)%% The research shows significant progress in machine learning capabilities.';
            const expectedContentWithAnnotations =
                'Scientists at leading universities have announced a %%[(REVOLUTIONARY)]( groundbreaking advancement in artificial intelligence.) The research shows significant progress in machine learning capabilities.';

            await new ArticleFactory()
                .withCategory('TECHNOLOGY')
                .withCountry('US')
                .withLanguage('EN')
                .withHeadline('Revolutionary AI Breakthrough Announced')
                .withBody(testBody)
                .withPublishedAt(new Date('2024-03-15T14:30:00.000Z'))
                .asFake('Exaggerated claims about AI capabilities')
                .createInDatabase(testContext.prisma);

            // When
            const response = await testContext.gateways.httpServer.request('/articles?limit=1');
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(1);

            const article = data.items[0];

            // Test complete article structure with new clean schema
            expect(article).toEqual({
                authenticity: {
                    reason: 'Exaggerated claims about AI capabilities',
                    status: 'fake',
                },
                body: expectedContentWithAnnotations,
                frames: [],
                headline: 'Revolutionary AI Breakthrough Announced',
                id: expect.stringMatching(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                ),
                metadata: {
                    category: 'TECHNOLOGY',
                    classification: 'STANDARD',
                    country: 'US',
                    language: 'EN',
                },
                publishedAt: '2024-03-15T14:30:00.000Z',
            });
        });

        it('should handle legitimate articles with frames schema correctly', async () => {
            // Given
            const testBody =
                'This is a %%[(legitimate)]( news article with proper sourcing)%% and verified information.';
            const expectedContentRaw =
                'This is a legitimate news article with proper sourcing and verified information.';

            await new ArticleFactory()
                .withCategory('TECHNOLOGY')
                .withCountry('US')
                .withLanguage('EN')
                .withHeadline('Legitimate Tech News')
                .withBody(testBody)
                .withPublishedAt(new Date('2024-03-15T14:30:00.000Z'))
                .asReal()
                .createInDatabase(testContext.prisma);

            // When
            const response = await testContext.gateways.httpServer.request('/articles?limit=1');
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(1);

            const article = data.items[0];

            // Test complete legitimate article structure
            expect(article).toEqual({
                authenticity: {
                    status: 'authentic',
                },
                body: expectedContentRaw,
                frames: [],
                headline: 'Legitimate Tech News',
                id: expect.stringMatching(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                ),
                metadata: {
                    category: 'TECHNOLOGY',
                    classification: 'STANDARD',
                    country: 'US',
                    language: 'EN',
                },
                publishedAt: '2024-03-15T14:30:00.000Z',
            });
        });

        it('should handle mixed authenticity articles correctly', async () => {
            // Given
            await Promise.all([
                new ArticleFactory()
                    .withCategory('TECHNOLOGY')
                    .withHeadline('Real Tech News')
                    .asReal()
                    .createInDatabase(testContext.prisma),
                new ArticleFactory()
                    .withCategory('TECHNOLOGY')
                    .withHeadline('Fake Tech News')
                    .asFake('Fabricated information')
                    .createInDatabase(testContext.prisma),
            ]);

            // When
            const response = await testContext.gateways.httpServer.request(
                '/articles?category=TECHNOLOGY',
            );
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items).toHaveLength(2);

            const realArticle = data.items.find((item) => item.authenticity.status === 'authentic');
            const fakeArticle = data.items.find((item) => item.authenticity.status === 'fake');

            expect(realArticle).toBeDefined();
            expect(realArticle.headline).toContain('Real');
            expect(realArticle.authenticity.status).toBe('authentic');
            expect(realArticle.authenticity.reason).toBeUndefined();

            expect(fakeArticle).toBeDefined();
            expect(fakeArticle.headline).toContain('Fake');
            expect(fakeArticle.authenticity.status).toBe('fake');
            expect(fakeArticle.authenticity.reason).toBe('Fabricated information');
        });
    });

    describe('Error handling', () => {
        beforeEach(async () => {
            await new ArticleFactory().createInDatabase(testContext.prisma);
        });

        it('should handle invalid parameters with 422 status', async () => {
            const testCases = [
                { description: 'invalid cursor', path: '/articles?cursor=invalid-cursor' },
                {
                    description: 'invalid base64 cursor',
                    path: `/articles?cursor=${Buffer.from('not-a-timestamp').toString('base64')}`,
                },
                { description: 'invalid category', path: '/articles?category=INVALID' },
                { description: 'invalid country', path: '/articles?country=INVALID' },
                { description: 'invalid language', path: '/articles?language=INVALID' },
                { description: 'negative limit', path: '/articles?limit=-1' },
                { description: 'zero limit', path: '/articles?limit=0' },
                { description: 'non-numeric limit', path: '/articles?limit=abc' },
            ];

            for (const testCase of testCases) {
                const response = await testContext.gateways.httpServer.request(testCase.path);
                expect(response.status).toBe(422);
                expect(await response.json()).toMatchObject({
                    error: 'Invalid request parameters',
                });
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle case-insensitive parameters', async () => {
            // Given
            await new ArticleFactory()
                .withCategory('TECHNOLOGY')
                .withCountry('US')
                .withLanguage('EN')
                .createInDatabase(testContext.prisma);

            // When
            const response = await testContext.gateways.httpServer.request(
                '/articles?category=TECHNOLOGY&country=US&language=EN',
            );
            const data = await response.json();

            // Then
            expect(response.status).toBe(200);
            expect(data.items[0].metadata).toMatchObject({
                category: 'TECHNOLOGY',
                country: 'US',
                language: 'EN',
            });
        });

        it('should handle cursor at end of data', async () => {
            // Given
            await new ArticleFactory()
                .withCountry('US')
                .createManyInDatabase(testContext.prisma, 3);

            // When
            const response = await testContext.gateways.httpServer.request('/articles?limit=3');
            const data = await response.json();

            // Then
            expect(data.nextCursor).toBeNull();
            expect(data.items).toHaveLength(3);
        });
    });
});
