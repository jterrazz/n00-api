import { type LoggerPort } from '@jterrazz/logger';

// Configuration
import { type ReportPipelineTaskConfig } from '../../../../application/ports/inbound/configuration.port.js';

// Application
import { type TaskPort } from '../../../../application/ports/inbound/worker.port.js';
import { type GenerateArticleChallengesUseCase } from '../../../../application/use-cases/articles/generate-article-challenges.use-case.js';
import { type ClassifyReportsUseCase } from '../../../../application/use-cases/reports/classify-reports.use-case.js';
import { type DeduplicateReportsUseCase } from '../../../../application/use-cases/reports/deduplicate-reports.use-case.js';
import { type IngestReportsUseCase } from '../../../../application/use-cases/reports/ingest-reports.use-case.js';
import { type PublishReportsUseCase } from '../../../../application/use-cases/reports/publish-reports.use-case.js';

// Domain
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';

export class ReportPipelineTask implements TaskPort {
    public readonly executeOnStartup = true;
    public readonly name = 'report-pipeline';
    public readonly schedule = '0 */2 * * *'; // Every 2 hours

    constructor(
        private readonly ingestReports: IngestReportsUseCase,
        private readonly deduplicateReports: DeduplicateReportsUseCase,
        private readonly publishReports: PublishReportsUseCase,
        private readonly generateArticleChallenges: GenerateArticleChallengesUseCase,
        private readonly classifyReports: ClassifyReportsUseCase,
        private readonly taskConfigs: ReportPipelineTaskConfig[],
        private readonly logger: LoggerPort,
    ) {}

    async execute(): Promise<void> {
        this.logger.info('Report pipeline task started');

        try {
            this.logger.info('Loaded report pipeline configuration', {
                taskCount: this.taskConfigs.length,
                tasks: this.taskConfigs,
            });

            const languages = this.taskConfigs.map((config) => ({
                country: new Country(config.country),
                language: new Language(config.language),
            }));

            // Step 1: Ingest reports
            await Promise.all(
                languages.map(async ({ country, language }) => {
                    this.logger.info('Ingesting reports', {
                        country: country.toString(),
                        language: language.toString(),
                    });
                    return this.ingestReports.execute(language, country);
                }),
            );

            this.logger.info('Report ingestion completed');

            // Step 2: Deduplicate newly ingested reports
            await Promise.all(
                languages.map(async ({ country }) => {
                    this.logger.info('Deduplicating reports', {
                        country: country.toString(),
                    });
                    return this.deduplicateReports.execute(country);
                }),
            );

            this.logger.info('Report deduplication completed');

            // Step 3: Classify deduplicated reports
            await this.classifyReports.execute();

            this.logger.info('Report classification completed');

            // Step 4: Publish reports as articles
            await Promise.all(
                languages.map(async ({ country, language }) => {
                    this.logger.info('Publishing reports as articles', {
                        country: country.toString(),
                        language: language.toString(),
                    });
                    return this.publishReports.execute(language, country);
                }),
            );

            this.logger.info('Report publishing completed');

            // Step 5: Generate quiz questions/challenges for articles
            await Promise.all(
                languages.map(async ({ country, language }) => {
                    this.logger.info('Generating challenges for articles', {
                        country: country.toString(),
                        language: language.toString(),
                    });
                    return this.generateArticleChallenges.execute(language, country);
                }),
            );

            this.logger.info('Article challenges generation completed');

            this.logger.info('Report pipeline execution finished');
        } catch (error) {
            this.logger.error('Report pipeline encountered an error', { error });
            throw error;
        }
    }
}
