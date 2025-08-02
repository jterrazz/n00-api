import { type ModelPort, OpenRouterProvider, type ProviderPort } from '@jterrazz/intelligence';

export interface ModelsPort {
    gemini25Flash: ModelPort;
    gemini25FlashLite: ModelPort;
    grok4: ModelPort;
}
import { type LoggerPort, PinoLoggerAdapter } from '@jterrazz/logger';
import {
    type MonitoringPort,
    NewRelicMonitoringAdapter,
    NoopMonitoringAdapter,
} from '@jterrazz/monitoring';
import { Container, Injectable } from '@snap/ts-inject';
import { default as nodeConfiguration } from 'config';

import type { ConfigurationPort } from '../application/ports/inbound/configuration.port.js';

import type { ServerPort } from '../application/ports/inbound/server.port.js';
import type { TaskPort } from '../application/ports/inbound/worker.port.js';
import type { WorkerPort } from '../application/ports/inbound/worker.port.js';
import { type ArticleCompositionAgentPort } from '../application/ports/outbound/agents/article-composition.agent.js';
import { type ArticleFabricationAgentPort } from '../application/ports/outbound/agents/article-fabrication.agent.js';
import { type ArticleQuizGenerationAgentPort } from '../application/ports/outbound/agents/article-quiz-generation.agent.js';
import { type ReportClassificationAgentPort } from '../application/ports/outbound/agents/report-classification.agent.js';
import { type ReportDeduplicationAgentPort } from '../application/ports/outbound/agents/report-deduplication.agent.js';
import { type ReportIngestionAgentPort } from '../application/ports/outbound/agents/report-ingestion.agent.js';
import type { ArticleRepositoryPort } from '../application/ports/outbound/persistence/article-repository.port.js';
import { type ReportRepositoryPort } from '../application/ports/outbound/persistence/report-repository.port.js';
import type { NewsProviderPort } from '../application/ports/outbound/providers/news.port.js';
import { GenerateArticleChallengesUseCase } from '../application/use-cases/articles/generate-article-challenges.use-case.js';
import { GenerateArticlesFromReportsUseCase } from '../application/use-cases/articles/generate-articles-from-reports.use-case.js';
import { GetArticlesUseCase } from '../application/use-cases/articles/get-articles.use-case.js';
import { ClassifyReportsUseCase } from '../application/use-cases/reports/classify-reports.use-case.js';
import { IngestReportsUseCase } from '../application/use-cases/reports/ingest-reports.use-case.js';

import { NodeConfigAdapter } from '../infrastructure/inbound/configuration/node-config.adapter.js';
import { GetArticlesController } from '../infrastructure/inbound/server/articles/get-articles.controller.js';
import { HonoServerAdapter } from '../infrastructure/inbound/server/hono.adapter.js';
import { NodeCronAdapter } from '../infrastructure/inbound/worker/node-cron.adapter.js';
import { ReportPipelineTask } from '../infrastructure/inbound/worker/reports/report-pipeline.task.js';
import { ArticleCompositionAgentAdapter } from '../infrastructure/outbound/agents/article-composition.agent.js';
import { ArticleFabricationAgentAdapter } from '../infrastructure/outbound/agents/article-fabrication.agent.js';
import { ArticleQuizGenerationAgentAdapter } from '../infrastructure/outbound/agents/article-quiz-generation.agent.js';
import { ReportClassificationAgentAdapter } from '../infrastructure/outbound/agents/report-classification.agent.js';
import { ReportDeduplicationAgentAdapter } from '../infrastructure/outbound/agents/report-deduplication.agent.js';
import { ReportIngestionAgentAdapter } from '../infrastructure/outbound/agents/report-ingestion.agent.js';
import { PrismaArticleRepository } from '../infrastructure/outbound/persistence/article/prisma-article.adapter.js';
import { PrismaAdapter } from '../infrastructure/outbound/persistence/prisma.adapter.js';
import { PrismaReportRepository } from '../infrastructure/outbound/persistence/report/prisma-report.adapter.js';
import { CachedNewsAdapter } from '../infrastructure/outbound/providers/cached-news.adapter.js';
import { WorldNewsAdapter } from '../infrastructure/outbound/providers/world-news.adapter.js';

/**
 * Outbound adapters
 */
const databaseFactory = Injectable(
    'Database',
    ['Logger', 'Configuration'] as const,
    (logger: LoggerPort, config: ConfigurationPort) =>
        new PrismaAdapter(logger, config.getOutboundConfiguration().prisma.databaseUrl),
);

const loggerFactory = Injectable(
    'Logger',
    ['Configuration'] as const,
    (config: ConfigurationPort) =>
        new PinoLoggerAdapter({
            level: config.getInboundConfiguration().logger.level,
            prettyPrint: config.getInboundConfiguration().logger.prettyPrint,
        }),
);

const newsFactory = Injectable(
    'News',
    ['Configuration', 'Logger', 'NewRelic'] as const,
    (config: ConfigurationPort, logger: LoggerPort, monitoring: MonitoringPort) => {
        logger.info('Initializing WorldNews adapter', { adapter: 'WorldNews' });
        const newsAdapter = new WorldNewsAdapter(
            {
                apiKey: config.getOutboundConfiguration().worldNews.apiKey,
            },
            logger,
            monitoring,
        );
        const useCache = config.getOutboundConfiguration().worldNews.useCache;

        if (useCache) {
            const cachedNewsAdapter = new CachedNewsAdapter(
                newsAdapter,
                logger,
                config.getInboundConfiguration().env,
            );
            return cachedNewsAdapter;
        }

        return newsAdapter;
    },
);

const providerFactory = Injectable(
    'Provider',
    ['Configuration'] as const,
    (config: ConfigurationPort): ProviderPort =>
        new OpenRouterProvider({
            apiKey: config.getOutboundConfiguration().openRouter.apiKey,
            metadata: {
                application: 'jterrazz-agents',
                website: 'https://jterrazz.com',
            },
        }),
);

// Helper function to select model based on budget
const selectModelByBudget = (
    models: ModelsPort,
    budget: 'high' | 'low' | 'medium',
    preferredModel: 'gemini25Flash' | 'gemini25FlashLite' | 'grok4',
): ModelPort => {
    if (budget === 'low') {
        return models.gemini25FlashLite;
    }
    return models[preferredModel];
};

const modelsFactory = Injectable(
    'Models',
    ['Provider'] as const,
    (provider: ProviderPort): ModelsPort => ({
        gemini25Flash: provider.getModel('google/gemini-2.5-flash', {
            maxTokens: 128_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        gemini25FlashLite: provider.getModel('google/gemini-2.5-flash-lite', {
            maxTokens: 128_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        grok4: provider.getModel('x-ai/grok-4', {
            maxTokens: 64_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
    }),
);

const reportIngestionAgentFactory = Injectable(
    'ReportIngestionAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportIngestionAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gemini25Flash',
            ),
            logger,
        ),
);

const articleCompositionAgentFactory = Injectable(
    'ArticleCompositionAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleCompositionAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gemini25Flash',
            ),
            logger,
        ),
);

const articleFabricationAgentFactory = Injectable(
    'ArticleFabricationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleFabricationAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'grok4',
            ),
            logger,
        ),
);

const articleQuizGenerationAgentFactory = Injectable(
    'ArticleQuizGenerationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleQuizGenerationAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gemini25Flash',
            ),
            logger,
        ),
);

const reportClassificationAgentFactory = Injectable(
    'ReportClassificationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportClassificationAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gemini25FlashLite',
            ),
            logger,
        ),
);

const reportDeduplicationAgentFactory = Injectable(
    'ReportDeduplicationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportDeduplicationAgentAdapter(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gemini25Flash',
            ),
            logger,
        ),
);

/**
 * Repository adapters
 */
const articleRepositoryFactory = Injectable(
    'ArticleRepository',
    ['Database', 'Logger'] as const,
    (db: PrismaAdapter, logger: LoggerPort) => {
        logger.info('Initializing Article repository', { repository: 'PrismaArticle' });
        const articleRepository = new PrismaArticleRepository(db);
        return articleRepository;
    },
);

const reportRepositoryFactory = Injectable(
    'ReportRepository',
    ['Database', 'Logger'] as const,
    (db: PrismaAdapter, logger: LoggerPort) => {
        logger.info('Initializing Report repository', { repository: 'PrismaReport' });
        const reportRepository = new PrismaReportRepository(db, logger);
        return reportRepository;
    },
);

/**
 * Use case factories
 */
const getArticlesUseCaseFactory = Injectable(
    'GetArticles',
    ['ArticleRepository'] as const,
    (articleRepository: ArticleRepositoryPort) => new GetArticlesUseCase(articleRepository),
);

const ingestReportsUseCaseFactory = Injectable(
    'IngestReports',
    [
        'ReportIngestionAgent',
        'ReportDeduplicationAgent',
        'Logger',
        'News',
        'ReportRepository',
    ] as const,
    (
        reportIngestionAgent: ReportIngestionAgentPort,
        reportDeduplicationAgent: ReportDeduplicationAgentPort,
        logger: LoggerPort,
        newsService: NewsProviderPort,
        reportRepository: ReportRepositoryPort,
    ) =>
        new IngestReportsUseCase(
            reportIngestionAgent,
            reportDeduplicationAgent,
            logger,
            newsService,
            reportRepository,
        ),
);

const generateArticlesFromReportsUseCaseFactory = Injectable(
    'GenerateArticlesFromReports',
    [
        'ArticleCompositionAgent',
        'ArticleFabricationAgent',
        'Logger',
        'ReportRepository',
        'ArticleRepository',
    ] as const,
    (
        articleCompositionAgent: ArticleCompositionAgentPort,
        articleFabricationAgent: ArticleFabricationAgentPort,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
        articleRepository: ArticleRepositoryPort,
    ) =>
        new GenerateArticlesFromReportsUseCase(
            articleCompositionAgent,
            articleFabricationAgent,
            logger,
            reportRepository,
            articleRepository,
        ),
);

const classifyReportsUseCaseFactory = Injectable(
    'ClassifyReports',
    ['ReportClassificationAgent', 'Logger', 'ReportRepository'] as const,
    (
        reportClassificationAgent: ReportClassificationAgentPort,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
    ) => new ClassifyReportsUseCase(reportClassificationAgent, logger, reportRepository),
);

const generateArticleChallengesUseCaseFactory = Injectable(
    'GenerateArticleChallenges',
    ['ArticleRepository', 'ArticleQuizGenerationAgent', 'Logger'] as const,
    (
        articleRepository: ArticleRepositoryPort,
        articleQuizGenerationAgent: ArticleQuizGenerationAgentPort,
        logger: LoggerPort,
    ) =>
        new GenerateArticleChallengesUseCase(articleRepository, articleQuizGenerationAgent, logger),
);

/**
 * Controller factories
 */
const controllersFactory = Injectable(
    'Controllers',
    ['GetArticles'] as const,
    (getArticles: GetArticlesUseCase) => ({
        getArticles: new GetArticlesController(getArticles),
    }),
);

/**
 * Task factories
 */
const tasksFactory = Injectable(
    'Tasks',
    [
        'IngestReports',
        'GenerateArticlesFromReports',
        'GenerateArticleChallenges',
        'ClassifyReports',
        'Configuration',
        'Logger',
    ] as const,
    (
        ingestReports: IngestReportsUseCase,
        generateArticlesFromReports: GenerateArticlesFromReportsUseCase,
        generateArticleChallenges: GenerateArticleChallengesUseCase,
        classifyReports: ClassifyReportsUseCase,
        configuration: ConfigurationPort,
        logger: LoggerPort,
    ): TaskPort[] => {
        const tasks: TaskPort[] = [];

        // Report pipeline task
        const reportPipelineConfigs = configuration.getInboundConfiguration().tasks.reportPipeline;
        tasks.push(
            new ReportPipelineTask(
                ingestReports,
                generateArticlesFromReports,
                generateArticleChallenges,
                classifyReports,
                reportPipelineConfigs,
                logger,
            ),
        );

        return tasks;
    },
);

/**
 * Monitoring adapters
 */
const newRelicFactory = Injectable(
    'NewRelic',
    ['Configuration', 'Logger'] as const,
    (config: ConfigurationPort, logger: LoggerPort): MonitoringPort => {
        const outboundConfig = config.getOutboundConfiguration();

        if (!outboundConfig.newRelic.enabled) {
            return new NoopMonitoringAdapter(logger);
        }

        logger.info('Initializing NewRelic monitoring', { adapter: 'NewRelic' });
        return new NewRelicMonitoringAdapter({
            environment: config.getInboundConfiguration().env,
            licenseKey: outboundConfig.newRelic.licenseKey,
            logger,
        });
    },
);

/**
 * Inbound adapters
 */
const configurationFactory = (overrides?: ContainerOverrides) =>
    Injectable('Configuration', () => new NodeConfigAdapter(nodeConfiguration, overrides));

const serverFactory = Injectable(
    'Server',
    ['Logger', 'Controllers'] as const,
    (logger: LoggerPort, controllers: { getArticles: GetArticlesController }): ServerPort => {
        logger.info('Initializing Server', { implementation: 'Hono' });
        const server = new HonoServerAdapter(logger, controllers.getArticles);
        return server;
    },
);

const workerFactory = Injectable(
    'Worker',
    ['Logger', 'Tasks'] as const,
    (logger: LoggerPort, tasks: TaskPort[]): WorkerPort => {
        logger.info('Initializing Worker', { implementation: 'NodeCron' });
        const worker = new NodeCronAdapter(logger, tasks);
        return worker;
    },
);

/**
 * Container configuration
 */
export type ContainerOverrides = {
    databaseUrl?: string;
};

export const createContainer = (overrides?: ContainerOverrides) =>
    Container
        // Outbound adapters
        .provides(configurationFactory(overrides))
        .provides(loggerFactory)
        .provides(newRelicFactory)
        .provides(databaseFactory)
        .provides(newsFactory)
        .provides(providerFactory)
        .provides(modelsFactory)
        .provides(reportIngestionAgentFactory)
        .provides(articleCompositionAgentFactory)
        .provides(articleFabricationAgentFactory)
        .provides(articleQuizGenerationAgentFactory)
        .provides(reportClassificationAgentFactory)
        .provides(reportDeduplicationAgentFactory)
        // Repositories
        .provides(articleRepositoryFactory)
        .provides(reportRepositoryFactory)
        // Use cases
        .provides(getArticlesUseCaseFactory)
        .provides(ingestReportsUseCaseFactory)
        .provides(generateArticlesFromReportsUseCaseFactory)
        .provides(generateArticleChallengesUseCaseFactory)
        .provides(classifyReportsUseCaseFactory)
        // Controllers and tasks
        .provides(controllersFactory)
        .provides(tasksFactory)
        // Inbound adapters
        .provides(serverFactory)
        .provides(workerFactory);
