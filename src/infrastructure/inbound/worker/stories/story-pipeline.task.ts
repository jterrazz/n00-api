import { type LoggerPort } from '@jterrazz/logger';

import { type StoryPipelineTaskConfig } from '../../../../application/ports/inbound/configuration.port.js';

import { type TaskPort } from '../../../../application/ports/inbound/worker.port.js';
import { type GenerateArticlesFromStoriesUseCase } from '../../../../application/use-cases/articles/generate-articles-from-stories.use-case.js';
import { type ClassifyStoriesUseCase } from '../../../../application/use-cases/stories/classify-stories.use-case.js';
import { type IngestStoriesUseCase } from '../../../../application/use-cases/stories/ingest-stories.use-case.js';

import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

export class StoryPipelineTask implements TaskPort {
    public readonly executeOnStartup = true;
    public readonly name = 'story-pipeline';
    public readonly schedule = '0 */2 * * *'; // Every 2 hours

    constructor(
        private readonly ingestStories: IngestStoriesUseCase,
        private readonly generateArticlesFromStories: GenerateArticlesFromStoriesUseCase,
        private readonly classifyStories: ClassifyStoriesUseCase,
        private readonly taskConfigs: StoryPipelineTaskConfig[],
        private readonly logger: LoggerPort,
    ) {}

    async execute(): Promise<void> {
        this.logger.info('task:story-pipeline:start');

        try {
            this.logger.info('task:story-pipeline:config', {
                taskCount: this.taskConfigs.length,
                tasks: this.taskConfigs,
            });

            const languages = this.taskConfigs.map((config) => ({
                country: new Country(config.country),
                language: new Language(config.language),
            }));

            // Step 1: Ingest stories
            await Promise.all(
                languages.map(async ({ country, language }) => {
                    this.logger.info('task:story-pipeline:ingest', {
                        country: country.toString(),
                        language: language.toString(),
                    });
                    return this.ingestStories.execute(language, country);
                }),
            );

            this.logger.info('task:story-pipeline:ingest:done');

            // Step 2: Classify newly ingested stories
            await this.classifyStories.execute();

            this.logger.info('task:story-pipeline:classify:done');

            // Step 3: Generate articles from stories that have been classified
            await Promise.all(
                languages.map(async ({ country, language }) => {
                    this.logger.info('task:story-pipeline:generate', {
                        country: country.toString(),
                        language: language.toString(),
                    });
                    return this.generateArticlesFromStories.execute(language, country);
                }),
            );

            this.logger.info('task:story-pipeline:done');
        } catch (error) {
            this.logger.error('task:story-pipeline:error', { error });
            throw error;
        }
    }
}
