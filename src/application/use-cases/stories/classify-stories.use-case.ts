import { type LoggerPort } from '@jterrazz/logger';

import { type StoryClassifierAgentPort } from '../../ports/outbound/agents/story-classifier.agent.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';

/**
 * @description
 * This use case is responsible for classifying stories that are in the
 * 'PENDING_REVIEW' state. It uses an AI agent to analyze each story
 * and assign it a final interest tier (`STANDARD`, `NICHE`, or `ARCHIVED`).
 */
export class ClassifyStoriesUseCase {
    constructor(
        private readonly storyClassifierAgent: StoryClassifierAgentPort,
        private readonly storyRepository: StoryRepositoryPort,
        private readonly logger: LoggerPort,
    ) {}

    public async execute(): Promise<void> {
        this.logger.info('Starting story classification process...');
        let classifiedCount = 0;
        let failedCount = 0;

        try {
            const storiesToReview = await this.storyRepository.findMany({
                limit: 50,
                where: { interestTier: 'PENDING_REVIEW' },
            });

            if (storiesToReview.length === 0) {
                this.logger.info('No stories found pending review.');
                return;
            }

            this.logger.info(`Found ${storiesToReview.length} stories to classify.`);

            for (const story of storiesToReview) {
                try {
                    const result = await this.storyClassifierAgent.run({ story });

                    if (result) {
                        await this.storyRepository.update(story.id, {
                            interestTier: result.interestTier,
                        });
                        this.logger.info(
                            `Story ${story.id} classified as ${result.interestTier}: ${result.reason}`,
                        );
                        classifiedCount++;
                    } else {
                        this.logger.warn(
                            `Failed to classify story ${story.id}: AI agent returned null.`,
                        );
                        failedCount++;
                    }
                } catch (error) {
                    this.logger.error(`Error classifying story ${story.id}`, { error });
                    failedCount++;
                }
            }
        } catch (error) {
            this.logger.error('Story classification process failed with an unhandled error.', {
                error,
            });
            throw error;
        }

        this.logger.info('Story classification process finished.', {
            failed: failedCount,
            successful: classifiedCount,
            totalReviewed: classifiedCount + failedCount,
        });
    }
}
