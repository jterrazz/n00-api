import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { getMockStories } from '../../../../domain/entities/__mocks__/stories.mock.js';
import { type Story } from '../../../../domain/entities/story.entity.js';
import { Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import {
    type ArticleCompositionAgentPort,
    type ArticleCompositionResult,
} from '../../../ports/outbound/agents/article-composition.agent.js';
import { type ArticleRepositoryPort } from '../../../ports/outbound/persistence/article-repository.port.js';
import { type StoryRepositoryPort } from '../../../ports/outbound/persistence/story-repository.port.js';

import { GenerateArticlesFromStoriesUseCase } from '../generate-articles-from-stories.use-case.js';

describe('GenerateArticlesFromStoriesUseCase', () => {
    // Test constants
    const DEFAULT_COUNTRY = new Country('us');
    const DEFAULT_LANGUAGE = new Language('en');
    const TEST_STORIES_COUNT = 3;

    // Test fixtures
    let mockArticleCompositionAgent: DeepMockProxy<ArticleCompositionAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockStoryRepository: DeepMockProxy<StoryRepositoryPort>;
    let mockArticleRepository: DeepMockProxy<ArticleRepositoryPort>;
    let useCase: GenerateArticlesFromStoriesUseCase;
    let testStories: Story[];
    let mockCompositionResults: ArticleCompositionResult[];

    beforeEach(() => {
        mockArticleCompositionAgent = mock<ArticleCompositionAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockStoryRepository = mock<StoryRepositoryPort>();
        mockArticleRepository = mock<ArticleRepositoryPort>();

        useCase = new GenerateArticlesFromStoriesUseCase(
            mockArticleCompositionAgent,
            mockLogger,
            mockStoryRepository,
            mockArticleRepository,
        );

        testStories = getMockStories(TEST_STORIES_COUNT);

        // Create mock composition results
        mockCompositionResults = testStories.map((story, index) => ({
            body: `Composed article body for story ${index + 1} with neutral presentation of facts from all perspectives.`,
            category: story.category,
            headline: `Composed Article ${index + 1}`,
            variants: [
                {
                    body: `Variant article body for story ${index + 1} presenting a specific viewpoint on the matter.`,
                    discourse: 'mainstream',
                    headline: `${story.category.toString()} Perspective: ${index + 1}`,
                    stance: 'neutral',
                },
            ],
        }));

        // Default mock responses
        mockStoryRepository.findStoriesWithoutArticles.mockResolvedValue(testStories);
        mockArticleCompositionAgent.run.mockImplementation(async () => mockCompositionResults[0]);
        mockArticleRepository.createMany.mockResolvedValue();
    });

    describe('execute', () => {
        test('should compose articles successfully for stories without articles', async () => {
            // Given - valid country and language parameters
            const country = DEFAULT_COUNTRY;
            const language = DEFAULT_LANGUAGE;

            // When - executing the use case
            const result = await useCase.execute(language, country);

            // Then - it should find stories without articles
            expect(mockStoryRepository.findStoriesWithoutArticles).toHaveBeenCalledWith({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20,
            });

            // And compose articles for each story through the agent
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_STORIES_COUNT);
            testStories.forEach((story) => {
                expect(mockArticleCompositionAgent.run).toHaveBeenCalledWith({
                    story,
                    targetCountry: country,
                    targetLanguage: language,
                });
            });

            // And save each composed article
            expect(mockArticleRepository.createMany).toHaveBeenCalledTimes(TEST_STORIES_COUNT);

            // And return the composed articles
            expect(result).toHaveLength(TEST_STORIES_COUNT);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        category: expect.any(Category),
                        country: expect.any(Country),
                        storyIds: expect.arrayContaining([expect.any(String)]),
                    }),
                ]),
            );

            // All articles should be neutral/factual
            result.forEach((article) => {
                expect(article.isFake()).toBe(false);
            });
        });

        test('should handle empty stories result gracefully', async () => {
            // Given - no stories without articles
            mockStoryRepository.findStoriesWithoutArticles.mockResolvedValue([]);

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should return empty array without calling agent or repository
            expect(mockArticleCompositionAgent.run).not.toHaveBeenCalled();
            expect(mockArticleRepository.createMany).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        test('should handle null response from article composer agent', async () => {
            // Given - agent returns null for some stories
            mockArticleCompositionAgent.run.mockImplementation(async (params) => {
                // Return null for first story, valid result for others
                return params?.story === testStories[0] ? null : mockCompositionResults[0];
            });

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should skip null results and process valid ones
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_STORIES_COUNT);
            expect(mockArticleRepository.createMany).toHaveBeenCalledTimes(TEST_STORIES_COUNT - 1);
            expect(result).toHaveLength(TEST_STORIES_COUNT - 1);
        });

        test('should continue processing if individual article composition fails', async () => {
            // Given - agent throws error for one story
            mockArticleCompositionAgent.run.mockImplementation(async (params) => {
                if (params?.story === testStories[1]) {
                    throw new Error('Agent composition failed');
                }
                return mockCompositionResults[0];
            });

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should continue processing other stories
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_STORIES_COUNT);
            expect(mockArticleRepository.createMany).toHaveBeenCalledTimes(TEST_STORIES_COUNT - 1);
            expect(result).toHaveLength(TEST_STORIES_COUNT - 1);
        });

        test('should handle different countries and languages', async () => {
            // Given - different country and language
            const country = new Country('fr');
            const language = new Language('fr');

            // When - executing the use case
            await useCase.execute(language, country);

            // Then - it should pass correct parameters to story repository
            expect(mockStoryRepository.findStoriesWithoutArticles).toHaveBeenCalledWith({
                classification: ['STANDARD', 'NICHE'],
                country: country.toString(),
                limit: 20,
            });

            // And pass correct parameters to article composer
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetCountry: country,
                    targetLanguage: language,
                }),
            );
        });

        test('should throw error when story repository fails', async () => {
            // Given - story repository throws error
            const repositoryError = new Error('Story repository failed');
            mockStoryRepository.findStoriesWithoutArticles.mockRejectedValue(repositoryError);

            // When - executing the use case
            // Then - it should throw the error
            await expect(useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY)).rejects.toThrow(
                'Story repository failed',
            );

            expect(mockArticleCompositionAgent.run).not.toHaveBeenCalled();
            expect(mockArticleRepository.createMany).not.toHaveBeenCalled();
        });

        test('should continue processing when article repository fails', async () => {
            // Given - article repository throws error on create
            mockArticleRepository.createMany.mockRejectedValue(
                new Error('Article repository failed'),
            );

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should continue processing and return empty array
            expect(mockArticleCompositionAgent.run).toHaveBeenCalledTimes(TEST_STORIES_COUNT);
            expect(mockArticleRepository.createMany).toHaveBeenCalledTimes(TEST_STORIES_COUNT);
            expect(result).toEqual([]);
        });

        test('should create articles with correct story relationships', async () => {
            // Given - valid stories and composition results
            const testStory = testStories[0];
            mockStoryRepository.findStoriesWithoutArticles.mockResolvedValue([testStory]);
            mockArticleCompositionAgent.run.mockResolvedValue(mockCompositionResults[0]);

            // When - executing the use case
            const result = await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

            // Then - it should create article with story relationship
            expect(result).toHaveLength(1);
            expect(result[0].storyIds).toEqual([testStory.id]);
            expect(result[0].publishedAt).toEqual(testStory.dateline);
            expect(result[0].category).toEqual(testStory.category);
            // And article should be neutral/factual
            expect(result[0].isFake()).toBe(false);
        });
    });
});
