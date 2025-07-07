import { beforeEach, describe, expect, it } from '@jterrazz/test';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { mockArticles } from '../../../../domain/entities/__mocks__/articles.mock.js';
import { type Article } from '../../../../domain/entities/article.entity.js';
import { Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article-repository.port.js';

import { type GetArticlesParams, GetArticlesUseCase } from '../get-articles.use-case.js';

describe('GetArticlesUseCase', () => {
    // Test constants
    const DEFAULT_LIMIT = 10;
    const TEST_ARTICLES_COUNT = 20;
    const DEFAULT_COUNTRY = new Country('us');
    const DEFAULT_LANGUAGE = new Language('en');

    // Test fixtures
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;
    let useCase: GetArticlesUseCase;
    let testArticles: Article[];

    beforeEach(() => {
        mockArticleRepository = mock<ArticleRepositoryPort>();
        useCase = new GetArticlesUseCase(mockArticleRepository);
        testArticles = mockArticles(TEST_ARTICLES_COUNT);

        // Default mock responses
        mockArticleRepository.findMany.mockResolvedValue(testArticles);
        mockArticleRepository.countMany.mockResolvedValue(TEST_ARTICLES_COUNT);
    });

    /**
     * Helper to create basic test parameters
     */
    const createParams = (overrides: Partial<GetArticlesParams> = {}): GetArticlesParams => ({
        country: DEFAULT_COUNTRY,
        language: DEFAULT_LANGUAGE,
        limit: DEFAULT_LIMIT,
        ...overrides,
    });

    describe('execute', () => {
        it('should return paginated articles with default parameters', async () => {
            // Given - basic parameters
            const params = createParams();

            // When - executing the use case
            const result = await useCase.execute(params);

            // Then - it should call repository methods correctly
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith({
                category: undefined,
                classification: ['STANDARD', 'NICHE'],
                country: DEFAULT_COUNTRY,
                cursor: undefined,
                language: DEFAULT_LANGUAGE,
                limit: DEFAULT_LIMIT + 1,
            });

            expect(mockArticleRepository.countMany).toHaveBeenCalledWith({
                category: undefined,
                country: DEFAULT_COUNTRY,
                language: DEFAULT_LANGUAGE,
            });

            // And return correct paginated response
            expect(result).toEqual({
                items: testArticles.slice(0, DEFAULT_LIMIT),
                lastItemDate: expect.any(Date),
                total: TEST_ARTICLES_COUNT,
            });
        });

        it('should handle custom limit parameter', async () => {
            // Given - custom limit
            const customLimit = 5;
            const params = createParams({ limit: customLimit });

            // When - executing the use case
            const result = await useCase.execute(params);

            // Then - it should respect the custom limit
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ limit: customLimit + 1 }),
            );
            expect(result.items).toHaveLength(customLimit);
        });

        it('should handle category filter', async () => {
            // Given - category filter
            const category = new Category('technology');
            const params = createParams({ category });

            // When - executing the use case
            await useCase.execute(params);

            // Then - it should pass category to both repository methods
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ category }),
            );
            expect(mockArticleRepository.countMany).toHaveBeenCalledWith(
                expect.objectContaining({ category }),
            );
        });

        it('should handle country filter', async () => {
            // Given - different country
            const country = new Country('fr');
            const params = createParams({ country });

            // When - executing the use case
            await useCase.execute(params);

            // Then - it should pass country to both repository methods
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ country }),
            );
            expect(mockArticleRepository.countMany).toHaveBeenCalledWith(
                expect.objectContaining({ country }),
            );
        });

        it('should handle language filter', async () => {
            // Given - different language
            const language = new Language('fr');
            const params = createParams({ language });

            // When - executing the use case
            await useCase.execute(params);

            // Then - it should pass language to both repository methods
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ language }),
            );
            expect(mockArticleRepository.countMany).toHaveBeenCalledWith(
                expect.objectContaining({ language }),
            );
        });

        it('should handle cursor-based pagination', async () => {
            // Given - cursor for pagination
            const cursor = new Date('2024-01-01T10:00:00Z');
            const params = createParams({ cursor });

            // When - executing the use case
            await useCase.execute(params);

            // Then - it should pass cursor to findMany but not countMany
            expect(mockArticleRepository.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ cursor }),
            );
            expect(mockArticleRepository.countMany).toHaveBeenCalledWith(
                expect.not.objectContaining({ cursor }),
            );
        });

        it('should return null lastItemDate when no more pages', async () => {
            // Given - fewer items than page size
            const partialResults = testArticles.slice(0, 5);
            mockArticleRepository.findMany.mockResolvedValue(partialResults);

            // When - executing the use case
            const result = await useCase.execute(createParams());

            // Then - it should indicate no more pages
            expect(result.lastItemDate).toBeNull();
            expect(result.items).toHaveLength(5);
        });
    });
});
