import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'node:crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

// Domain
import { Article } from '../../../../domain/entities/article.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../../domain/value-objects/article/headline.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

// Ports
import {
    type ArticleFabricationAgentPort,
    type ArticleFabricationResult,
} from '../../../ports/outbound/agents/article-fabrication.agent.js';
import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article/article-repository.port.js';

import { FabricateArticlesUseCase } from '../fabricate-articles.use-case.js';

describe('FabricateArticlesUseCase', () => {
    let useCase: FabricateArticlesUseCase;
    let mockArticleFabricationAgent: DeepMockProxy<ArticleFabricationAgentPort>;
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;

    beforeEach(() => {
        mockArticleFabricationAgent = mock<ArticleFabricationAgentPort>();
        mockArticleRepository = mock<ArticleRepositoryPort>();
        mockLogger = mock<LoggerPort>();

        useCase = new FabricateArticlesUseCase(
            mockArticleFabricationAgent,
            mockArticleRepository,
            mockLogger,
        );
    });

    describe('execute', () => {
        const testLanguage = new Language('EN');
        const testCountry = new Country('US');

        test('should skip fabrication when insufficient baseline articles exist', async () => {
            // Given - insufficient articles (below threshold of 10)
            mockArticleRepository.countMany.mockResolvedValue(5);

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.info).toHaveBeenCalledWith('Skipping fake article generation', {
                country: 'US',
                language: 'EN',
                reason: 'Insufficient baseline articles',
                totalForLocale: 5,
            });
            expect(mockArticleRepository.findMany).not.toHaveBeenCalled();
        });

        test('should skip fabrication when fake article ratio is already satisfied', async () => {
            // Given - sufficient total articles but high fake ratio
            const existingRealArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Real article headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            const existingFakeArticle = new Article({
                authenticity: new Authenticity(
                    AuthenticityStatusEnum.FABRICATED,
                    'This is fake content',
                ),
                body: new Body(
                    'This is a fake body content that has at least thirty characters to pass validation requirements',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Fake article headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            mockArticleRepository.countMany.mockResolvedValue(15); // Above threshold
            mockArticleRepository.findMany.mockResolvedValue([
                existingRealArticle,
                existingFakeArticle,
            ]); // 50% fake ratio, too high

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.info).toHaveBeenCalledWith('Skipping fake article generation', {
                country: 'US',
                language: 'EN',
                reason: 'Recent fake article ratio already satisfied',
            });
            expect(mockArticleFabricationAgent.run).not.toHaveBeenCalled();
        });

        test('should generate fake articles when conditions are met', async () => {
            // Given - sufficient baseline with low fake ratio
            const existingArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Existing headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            const mockFabricationResult: ArticleFabricationResult = {
                body: 'This is a fake body content that has at least thirty characters to pass validation requirements',
                categories: new Categories(['WORLD']),
                clarification: 'This is fake',
                headline: 'Fake headline',
                insertAfterIndex: 0,
                tone: 'satirical',
            };

            mockArticleRepository.countMany.mockResolvedValue(15); // Above threshold
            mockArticleRepository.findMany.mockResolvedValue([existingArticle]); // Only real articles
            mockArticleFabricationAgent.run.mockResolvedValue(mockFabricationResult);
            mockArticleRepository.createMany.mockResolvedValue();

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(1);
            expect(result[0].isFabricated()).toBe(true);
            expect(result[0].headline.value).toBe('Fake headline');

            expect(mockArticleFabricationAgent.run).toHaveBeenCalledWith({
                context: {
                    currentDate: expect.any(Date),
                    recentArticles: [
                        {
                            body: existingArticle.body.value,
                            frames: [],
                            headline: existingArticle.headline.value,
                            publishedAt: existingArticle.publishedAt.toISOString(),
                        },
                    ],
                },
                targetCountry: testCountry,
                targetLanguage: testLanguage,
            });

            expect(mockArticleRepository.createMany).toHaveBeenCalledWith([expect.any(Article)]);
        });

        test('should handle fabrication agent returning null', async () => {
            // Given
            const existingArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Existing headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            mockArticleRepository.countMany.mockResolvedValue(15); // Above threshold
            mockArticleRepository.findMany.mockResolvedValue([existingArticle]);
            mockArticleFabricationAgent.run.mockResolvedValue(null); // Agent returns null

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('Fabrication agent returned no result', {
                country: 'US',
                language: 'EN',
            });
            expect(mockArticleRepository.createMany).not.toHaveBeenCalled();
        });

        test('should handle publication date calculation with insertAfterIndex', async () => {
            // Given
            const baseDate = new Date('2023-01-01T12:00:00Z');
            const existingArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Existing headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: baseDate,
                traits: new ArticleTraits(),
            });

            const mockFabricationResult: ArticleFabricationResult = {
                body: 'This is a fake body content that has at least thirty characters to pass validation requirements',
                categories: new Categories(['WORLD']),
                clarification: 'This is fake',
                headline: 'Fake headline',
                insertAfterIndex: 0, // Insert after first article
                tone: 'satirical',
            };

            mockArticleRepository.countMany.mockResolvedValue(15);
            mockArticleRepository.findMany.mockResolvedValue([existingArticle]);
            mockArticleFabricationAgent.run.mockResolvedValue(mockFabricationResult);
            mockArticleRepository.createMany.mockResolvedValue();

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(1);
            const fakeArticle = result[0];

            // Should be published after the base article (with offset)
            expect(fakeArticle.publishedAt.getTime()).toBeGreaterThan(baseDate.getTime());
            expect(fakeArticle.publishedAt.getTime()).toBeLessThanOrEqual(Date.now());
        });

        test('should handle errors gracefully and continue processing', async () => {
            // Given
            const existingArticle = new Article({
                authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
                body: new Body(
                    'This is a longer existing body content that meets the minimum length requirements for the article body validation',
                ),
                categories: new Categories(['WORLD']),
                country: testCountry,
                headline: new Headline('Existing headline'),
                id: randomUUID(),
                language: testLanguage,
                publishedAt: new Date(),
                traits: new ArticleTraits(),
            });

            mockArticleRepository.countMany.mockResolvedValue(15);
            mockArticleRepository.findMany.mockResolvedValue([existingArticle]);
            mockArticleFabricationAgent.run.mockRejectedValue(new Error('AI service error'));

            // When
            const result = await useCase.execute(testLanguage, testCountry);

            // Then
            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('Error generating fake article', {
                country: 'US',
                error: expect.any(Error),
                language: 'EN',
            });
        });
    });
});
