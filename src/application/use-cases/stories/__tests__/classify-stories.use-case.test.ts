import { type LoggerPort } from '@jterrazz/logger';
import { beforeEach, describe, expect, mockOf, test } from '@jterrazz/test';
import { randomUUID } from 'crypto';
import { type DeepMockProxy, mock } from 'vitest-mock-extended';

import { Perspective } from '../../../../domain/entities/perspective.entity.js';
import { Story } from '../../../../domain/entities/story.entity.js';
import { Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { HolisticDigest } from '../../../../domain/value-objects/perspective/holistic-digest.vo.js';
import { PerspectiveTags } from '../../../../domain/value-objects/perspective/perspective-tags.vo.js';
import { InterestTier } from '../../../../domain/value-objects/story/interest-tier.vo.js';

import {
    type StoryClassifierAgentPort,
    type StoryClassifierResult,
} from '../../../ports/outbound/agents/story-classifier.agent.js';
import { type StoryRepositoryPort } from '../../../ports/outbound/persistence/story-repository.port.js';

import { ClassifyStoriesUseCase } from '../classify-stories.use-case.js';

const createMockStory = (
    id: string,
    tier: 'NICHE' | 'PENDING_REVIEW' | 'STANDARD' = 'PENDING_REVIEW',
): Story => {
    const storyId = id;
    return new Story({
        category: new Category('technology'),
        country: new Country('us'),
        createdAt: new Date(),
        dateline: new Date(),
        id: storyId,
        interestTier: new InterestTier(tier),
        perspectives: [
            new Perspective({
                createdAt: new Date(),
                holisticDigest: new HolisticDigest(
                    'This is a very long and detailed holistic digest for the mock perspective, created specifically for testing. It needs to be over 200 characters long to pass the validation rules of the value object. This ensures that when our use case tests run, they do not fail due to simple validation errors in the mock data construction process, allowing us to focus on the actual logic of the use case itself.',
                ),
                id: randomUUID(),
                storyId,
                tags: new PerspectiveTags({ discourse_type: 'mainstream', stance: 'neutral' }),
                updatedAt: new Date(),
            }),
        ],
        sourceReferences: ['source-1'],
        synopsis:
            'This is a valid story synopsis that is definitely long enough for testing purposes. It details the event and provides context that should be sufficient for any validation checks that might be in place, ensuring that this mock object is robust.',
        updatedAt: new Date(),
    });
};

describe('ClassifyStoriesUseCase', () => {
    let mockStoryClassifierAgent: DeepMockProxy<StoryClassifierAgentPort>;
    let mockStoryRepository: DeepMockProxy<StoryRepositoryPort>;
    let mockLogger: DeepMockProxy<LoggerPort>;
    let useCase: ClassifyStoriesUseCase;

    // Test data
    let storyToReview: Story;

    beforeEach(() => {
        storyToReview = createMockStory(randomUUID());

        mockStoryClassifierAgent = mock<StoryClassifierAgentPort>();
        mockStoryRepository = mock<StoryRepositoryPort>();
        mockLogger = mockOf<LoggerPort>();

        useCase = new ClassifyStoriesUseCase(
            mockStoryClassifierAgent,
            mockStoryRepository,
            mockLogger,
        );

        // Default mock implementations
        mockStoryRepository.findMany.mockResolvedValue([storyToReview]);
        mockStoryRepository.update.mockResolvedValue();
    });

    describe('execute', () => {
        test('should classify stories pending review and update their status', async () => {
            // Given
            const classificationResult: StoryClassifierResult = {
                interestTier: 'STANDARD',
                reason: 'A solid, well-written story with broad appeal.',
            };
            mockStoryClassifierAgent.run.mockResolvedValue(classificationResult);

            // When
            await useCase.execute();

            // Then
            expect(mockStoryRepository.findMany).toHaveBeenCalledWith({
                limit: 50,
                where: { interestTier: 'PENDING_REVIEW' },
            });
            expect(mockStoryClassifierAgent.run).toHaveBeenCalledWith({ story: storyToReview });
            expect(mockStoryRepository.update).toHaveBeenCalledWith(storyToReview.id, {
                interestTier: 'STANDARD',
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
            expect(mockStoryClassifierAgent.run).not.toHaveBeenCalled();
            expect(mockStoryRepository.update).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('No stories found pending review.');
        });

        test('should continue processing even if one story fails classification', async () => {
            // Given
            const story1 = createMockStory(randomUUID());
            const story2 = createMockStory(randomUUID());
            mockStoryRepository.findMany.mockResolvedValue([story1, story2]);

            mockStoryClassifierAgent.run
                .mockResolvedValueOnce({
                    interestTier: 'NICHE',
                    reason: 'Interesting but for a specific audience.',
                })
                .mockResolvedValueOnce(null); // Second story fails

            // When
            await useCase.execute();

            // Then
            expect(mockStoryClassifierAgent.run).toHaveBeenCalledTimes(2);
            expect(mockStoryRepository.update).toHaveBeenCalledWith(story1.id, {
                interestTier: 'NICHE',
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
            mockStoryClassifierAgent.run.mockRejectedValue(agentError);

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
