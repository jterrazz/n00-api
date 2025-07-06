import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Story } from '../../../../domain/entities/story.entity.js';
import { Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Classification } from '../../../../domain/value-objects/story/classification.vo.js';
import { PerspectiveCorpus } from '../../../../domain/value-objects/story/perspective/perspective-corpus.vo.js';
import { StoryPerspective } from '../../../../domain/value-objects/story/perspective/story-perspective.vo.js';

import {
    type StoryClassificationAgentPort,
    type StoryClassificationResult,
} from '../../../ports/outbound/agents/story-classification.agent.js';
import { type StoryRepositoryPort } from '../../../ports/outbound/persistence/story-repository.port.js';

import { ClassifyStoriesUseCase } from '../classify-stories.use-case.js';

const createMockStory = (
    id: string,
    tier: 'NICHE' | 'PENDING_CLASSIFICATION' | 'STANDARD' = 'PENDING_CLASSIFICATION',
): Story => {
    const storyId = id;
    return new Story({
        category: new Category('technology'),
        classification: new Classification(tier),
        country: new Country('us'),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        perspectives: [
            new StoryPerspective({
                discourse: 'mainstream',
                perspectiveCorpus: new PerspectiveCorpus(
                    'This is a very long and detailed holistic digest for the mock perspective, created specifically for testing. It needs to be over 200 characters long to pass the validation rules of the value object. This ensures that when our use case tests run, they do not fail due to simple validation errors in the mock data construction process, allowing us to focus on the actual logic of the use case itself.',
                ),
                stance: 'neutral',
            }),
        ],
        sourceReferences: ['source-1'],
        synopsis:
            'This is a valid story synopsis that is definitely long enough for testing purposes. It details the event and provides context that should be sufficient for any validation checks that might be in place, ensuring that this mock object is robust.',
        updatedAt: new Date(),
    });
};

describe('ClassifyStoriesUseCase', () => {
    let mockStoryClassificationAgent: DeepMockProxy<StoryClassificationAgentPort>;
    let mockStoryRepository: DeepMockProxy<StoryRepositoryPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let useCase: ClassifyStoriesUseCase;

    // Test data
    let storyToReview: Story;

    beforeEach(() => {
        storyToReview = createMockStory(randomUUID());

        mockStoryClassificationAgent = mock<StoryClassificationAgentPort>();
        mockStoryRepository = mock<StoryRepositoryPort>();
        mockLogger = mock<LoggerPort>();

        useCase = new ClassifyStoriesUseCase(
            mockStoryClassificationAgent,
            mockLogger,
            mockStoryRepository,
        );

        // Default mock implementations
        mockStoryRepository.findMany.mockResolvedValue([storyToReview]);
        mockStoryRepository.update.mockResolvedValue(storyToReview);
    });

    describe('execute', () => {
        test('should classify stories pending review and update their status', async () => {
            // Given
            const classificationResult: StoryClassificationResult = {
                classification: new Classification('STANDARD'),
                reason: 'A solid, well-written story with broad appeal.',
            };
            mockStoryClassificationAgent.run.mockResolvedValue(classificationResult);

            // When
            await useCase.execute();

            // Then
            expect(mockStoryRepository.findMany).toHaveBeenCalledWith({
                limit: 50,
                where: { classification: 'PENDING_CLASSIFICATION' },
            });
            expect(mockStoryClassificationAgent.run).toHaveBeenCalledWith({ story: storyToReview });
            expect(mockStoryRepository.update).toHaveBeenCalledWith(storyToReview.id, {
                classification: expect.any(Object),
            });
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Story ${storyToReview.id} classified as STANDARD: ${classificationResult.reason}`,
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Story classification process finished.', {
                failed: 0,
                successful: 1,
                totalReviewed: 1,
            });
        });

        test('should do nothing if no stories are pending review', async () => {
            // Given
            mockStoryRepository.findMany.mockResolvedValue([]);

            // When
            await useCase.execute();

            // Then
            expect(mockStoryClassificationAgent.run).not.toHaveBeenCalled();
            expect(mockStoryRepository.update).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'No stories found pending classification.',
            );
        });

        test('should continue processing even if one story fails classification', async () => {
            // Given
            const story1 = createMockStory(randomUUID());
            const story2 = createMockStory(randomUUID());
            mockStoryRepository.findMany.mockResolvedValue([story1, story2]);

            mockStoryClassificationAgent.run
                .mockResolvedValueOnce({
                    classification: new Classification('NICHE'),
                    reason: 'Interesting but for a specific audience.',
                })
                .mockResolvedValueOnce(null); // Second story fails

            // When
            await useCase.execute();

            // Then
            expect(mockStoryClassificationAgent.run).toHaveBeenCalledTimes(2);
            expect(mockStoryRepository.update).toHaveBeenCalledWith(story1.id, {
                classification: expect.any(Object),
            });
            expect(mockStoryRepository.update).not.toHaveBeenCalledWith(
                story2.id,
                expect.any(Object),
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Failed to classify story ${story2.id}: AI agent returned null.`,
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Story classification process finished.', {
                failed: 1,
                successful: 1,
                totalReviewed: 2,
            });
        });

        test('should handle errors during agent execution gracefully', async () => {
            // Given
            const agentError = new Error('AI agent failed');
            mockStoryClassificationAgent.run.mockRejectedValue(agentError);

            // When
            await useCase.execute();

            // Then
            expect(mockStoryRepository.update).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error classifying story ${storyToReview.id}`,
                { error: agentError },
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Story classification process finished.', {
                failed: 1,
                successful: 0,
                totalReviewed: 1,
            });
        });

        test('should throw an error if fetching stories fails', async () => {
            // Given
            const repositoryError = new Error('Database connection failed');
            mockStoryRepository.findMany.mockRejectedValue(repositoryError);

            // When / Then
            await expect(useCase.execute()).rejects.toThrow(repositoryError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Story classification process failed with an unhandled error.',
                { error: repositoryError },
            );
        });
    });
});
