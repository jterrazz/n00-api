import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { getMockStories } from '../../../../domain/entities/__mocks__/mock-of-stories.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

import { type StoryDeduplicationAgentPort } from '../../../ports/outbound/agents/story-deduplication.agent.js';
import {
    type StoryIngestionAgentPort,
    type StoryIngestionResult,
} from '../../../ports/outbound/agents/story-ingestion.agent.js';
import { type StoryRepositoryPort } from '../../../ports/outbound/persistence/story-repository.port.js';
import {
    type NewsProviderPort,
    type NewsStory,
} from '../../../ports/outbound/providers/news.port.js';

import { DigestStoriesUseCase } from '../digest-stories.use-case.js';

describe('DigestStoriesUseCase', () => {
    // Test Constants
    const DEFAULT_COUNTRY = new Country('us');
    const DEFAULT_LANGUAGE = new Language('en');
    const MOCK_NEWS_STORIES: NewsStory[] = [
        {
            articles: [
                { body: 'B1', headline: 'H1', id: 'a1' },
                { body: 'B2', headline: 'H2', id: 'a2' },
            ],
            publishedAt: new Date(),
        },
        {
            articles: [
                { body: 'B3', headline: 'H3', id: 'b1' },
                { body: 'B4', headline: 'H4', id: 'b2' },
            ],
            publishedAt: new Date(),
        },
    ];

    // Mocks
    let mockStoryIngestionAgent: DeepMockProxy<StoryIngestionAgentPort>;
    let mockStoryDeduplicationAgent: DeepMockProxy<StoryDeduplicationAgentPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let mockNewsProvider: DeepMockProxy<NewsProviderPort>;
    let mockStoryRepository: DeepMockProxy<StoryRepositoryPort>;
    let useCase: DigestStoriesUseCase;
    let mockIngestionResult: StoryIngestionResult;

    beforeEach(() => {
        mockStoryIngestionAgent = mock<StoryIngestionAgentPort>();
        mockStoryDeduplicationAgent = mock<StoryDeduplicationAgentPort>();
        mockLogger = mock<LoggerPort>();
        mockNewsProvider = mock<NewsProviderPort>();
        mockStoryRepository = mock<StoryRepositoryPort>();

        useCase = new DigestStoriesUseCase(
            mockStoryIngestionAgent,
            mockStoryDeduplicationAgent,
            mockLogger,
            mockNewsProvider,
            mockStoryRepository,
        );

        const mockStory = getMockStories(1)[0];
        mockIngestionResult = {
            category: mockStory.category,
            perspectives: mockStory.perspectives.map((p) => ({
                perspectiveCorpus: p.perspectiveCorpus,
                tags: p.tags,
            })),
            synopsis: mockStory.synopsis,
        };

        // Default happy path mocks
        mockNewsProvider.fetchNews.mockResolvedValue(MOCK_NEWS_STORIES);
        mockStoryRepository.findRecentSynopses.mockResolvedValue([]);
        mockStoryRepository.getAllSourceReferences.mockResolvedValue([]);
        mockStoryDeduplicationAgent.run.mockResolvedValue({
            duplicateOfStoryId: null,
        });
        mockStoryIngestionAgent.run.mockResolvedValue(mockIngestionResult);
        mockStoryRepository.create.mockImplementation(async (story) => story);
    });

    test('it should create new stories for unique, valid news items', async () => {
        // Given: The news provider returns two new, unique stories.

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should create a new story for each of them.
        expect(mockStoryIngestionAgent.run).toHaveBeenCalledTimes(2);
        expect(mockStoryRepository.create).toHaveBeenCalledTimes(2);
        expect(mockStoryRepository.addSourceReferences).not.toHaveBeenCalled();
    });

    test('it should merge sources when a semantically duplicate story is found', async () => {
        // Given: The deduplication agent identifies the second story as a duplicate of an existing one.
        const existingStoryId = 'existing-story-id';
        mockStoryDeduplicationAgent.run
            .mockResolvedValueOnce({ duplicateOfStoryId: null })
            .mockResolvedValueOnce({
                duplicateOfStoryId: existingStoryId,
            });

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should create one new story and merge the sources for the duplicate.
        expect(mockStoryIngestionAgent.run).toHaveBeenCalledTimes(1); // Only called for the first, unique story
        expect(mockStoryRepository.create).toHaveBeenCalledTimes(1);
        expect(mockStoryRepository.addSourceReferences).toHaveBeenCalledTimes(1);
        expect(mockStoryRepository.addSourceReferences).toHaveBeenCalledWith(existingStoryId, [
            'b1',
            'b2',
        ]);
    });

    test('it should ignore news stories that have already been processed by source ID', async () => {
        // Given: One of the news stories contains an article ID that is already in our database.
        mockStoryRepository.getAllSourceReferences.mockResolvedValue(['b1']);

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should only process the one truly new story.
        expect(mockStoryDeduplicationAgent.run).toHaveBeenCalledTimes(1);
        expect(mockStoryIngestionAgent.run).toHaveBeenCalledTimes(1);
        expect(mockStoryRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should ignore news stories with insufficient source articles to analyze', async () => {
        // Given: One of the news stories has only one article, which is below our quality threshold.
        mockNewsProvider.fetchNews.mockResolvedValue([
            { articles: [{ body: 'BC1', headline: 'HC1', id: 'c1' }], publishedAt: new Date() }, // Insufficient
            MOCK_NEWS_STORIES[1], // Sufficient
        ]);

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should only process the one valid story.
        expect(mockStoryDeduplicationAgent.run).toHaveBeenCalledTimes(1);
        expect(mockStoryIngestionAgent.run).toHaveBeenCalledTimes(1);
        expect(mockStoryRepository.create).toHaveBeenCalledTimes(1);
    });

    test('it should gracefully handle a failure from the ingestion agent', async () => {
        // Given: The ingestion agent fails for one of the stories.
        mockStoryIngestionAgent.run
            .mockResolvedValueOnce(mockIngestionResult)
            .mockResolvedValueOnce(null); // Second story fails to ingest

        // When
        await useCase.execute(DEFAULT_LANGUAGE, DEFAULT_COUNTRY);

        // Then: It should still successfully create the first story.
        expect(mockStoryRepository.create).toHaveBeenCalledTimes(1);
    });
});
