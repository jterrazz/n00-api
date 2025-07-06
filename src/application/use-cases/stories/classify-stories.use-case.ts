import { type LoggerPort } from '@jterrazz/logger';

import { Classification } from '../../../domain/value-objects/story/classification.vo.js';

import { type StoryClassifierAgentPort } from '../../ports/outbound/agents/story-classifier.agent.js';
import { type StoryRepositoryPort } from '../../ports/outbound/persistence/story-repository.port.js';

/**
 * @description
 * This use case is responsible for classifying stories that are in the
 * 'PENDING_CLASSIFICATION' state. It uses an AI agent to analyze each story
 * and assign it a final classification (`STANDARD`, `NICHE`, or `ARCHIVED`).
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
                where: { classification: 'PENDING_CLASSIFICATION' },
            });

            if (storiesToReview.length === 0) {
                this.logger.info('No stories found pending classification.');
                return;
            }

            this.logger.info(`Found ${storiesToReview.length} stories to classify.`);

            for (const story of storiesToReview) {
                try {
                    const result = await this.storyClassifierAgent.run({ story });

                    if (result) {
                        await this.storyRepository.update(story.id, {
                            classification: new Classification(result.classification),
                        });
                        this.logger.info(
                            `Story ${story.id} classified as ${result.classification}: ${result.reason}`,
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
