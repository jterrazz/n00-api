import { type ModelPort, OpenRouterProvider, type ProviderPort } from '@jterrazz/intelligence';

export interface ModelsPort {
    deepseekV3: ModelPort;
    gemini25Flash: ModelPort;
    gemini25FlashLite: ModelPort;
    glm45: ModelPort;
    gptOSS: ModelPort;
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
import { GetArticlesUseCase } from '../application/use-cases/articles/get-articles.use-case.js';
import { ClassifyReportsUseCase } from '../application/use-cases/reports/classify-reports.use-case.js';
import { DeduplicateReportsUseCase } from '../application/use-cases/reports/deduplicate-reports.use-case.js';
import { IngestReportsUseCase } from '../application/use-cases/reports/ingest-reports.use-case.js';
import { PublishReportsUseCase } from '../application/use-cases/reports/publish-reports.use-case.js';

import { NodeConfig } from '../infrastructure/inbound/configuration/node-config.js';
import { GetArticlesController } from '../infrastructure/inbound/server/articles/get-articles.controller.js';
import { HonoServer } from '../infrastructure/inbound/server/hono.server.js';
import { NodeCron } from '../infrastructure/inbound/worker/node-cron.worker.js';
import { ReportPipelineTask } from '../infrastructure/inbound/worker/reports/report-pipeline.task.js';
import { ArticleCompositionAgent } from '../infrastructure/outbound/agents/article-composition.agent.js';
import { ArticleFabricationAgent } from '../infrastructure/outbound/agents/article-fabrication.agent.js';
import { ArticleQuizGenerationAgent } from '../infrastructure/outbound/agents/article-quiz-generation.agent.js';
import { ReportClassificationAgent } from '../infrastructure/outbound/agents/report-classification.agent.js';
import { ReportDeduplicationAgent } from '../infrastructure/outbound/agents/report-deduplication.agent.js';
import { ReportIngestionAgent } from '../infrastructure/outbound/agents/report-ingestion.agent.js';
import { PrismaArticleRepository } from '../infrastructure/outbound/persistence/article/prisma-article.repository.js';
import { PrismaDatabase } from '../infrastructure/outbound/persistence/prisma.database.js';
import { PrismaReportRepository } from '../infrastructure/outbound/persistence/report/prisma-report.repository.js';
import { CachedNews } from '../infrastructure/outbound/providers/cached-news.provider.js';
import {
    WorldNews,
    type WorldNewsConfiguration,
} from '../infrastructure/outbound/providers/world-news.provider.js';

/**
 * Outbound adapters
 */
const databaseFactory = Injectable(
    'Database',
    ['Logger', 'Configuration'] as const,
    (logger: LoggerPort, config: ConfigurationPort) =>
        new PrismaDatabase(logger, config.getOutboundConfiguration().prisma.databaseUrl),
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
        logger.info('Initializing WorldNews provider', { provider: 'WorldNews' });
        const newsAdapter = new WorldNews(
            {
                apiKey: config.getOutboundConfiguration().worldNews.apiKey,
            } as WorldNewsConfiguration,
            logger,
            monitoring,
        );
        const useCache = config.getOutboundConfiguration().worldNews.useCache;

        if (useCache) {
            const cachedNewsProvider = new CachedNews(
                newsAdapter,
                logger,
                config.getInboundConfiguration().env,
            );
            return cachedNewsProvider;
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
    preferredModel:
        | 'deepseekV3'
        | 'gemini25Flash'
        | 'gemini25FlashLite'
        | 'glm45'
        | 'gptOSS'
        | 'grok4',
): ModelPort => {
    // if (budget === 'low') {
    //     return models.gemini25FlashLite;
    // }
    return models[preferredModel];
};

const modelsFactory = Injectable(
    'Models',
    ['Provider'] as const,
    (provider: ProviderPort): ModelsPort => ({
        deepseekV3: provider.getModel('deepseek/deepseek-chat-v3-0324', {
            maxTokens: 150_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        gemini25Flash: provider.getModel('google/gemini-2.5-flash', {
            maxTokens: 256_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        gemini25FlashLite: provider.getModel('google/gemini-2.5-flash-lite', {
            maxTokens: 256_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        glm45: provider.getModel('z-ai/glm-4.5', {
            maxTokens: 80_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        gptOSS: provider.getModel('openai/gpt-oss-120b', {
            maxTokens: 128_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
        grok4: provider.getModel('x-ai/grok-4', {
            maxTokens: 128_000,
            reasoning: {
                effort: 'high',
                exclude: true,
            },
        }),
    }),
);

// Ingestion requires a mix of: long context, reasoning, and text generation.
const reportIngestionAgentFactory = Injectable(
    'ReportIngestionAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportIngestionAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gptOSS',
            ),
            logger,
        ),
);

// Deduplication requires: reasoning and long context.
const reportDeduplicationAgentFactory = Injectable(
    'ReportDeduplicationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportDeduplicationAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'deepseekV3',
            ),
            logger,
        ),
);

// Classification requires: reasoning.
const reportClassificationAgentFactory = Injectable(
    'ReportClassificationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ReportClassificationAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'deepseekV3',
            ),
            logger,
        ),
);

const articleCompositionAgentFactory = Injectable(
    'ArticleCompositionAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleCompositionAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gptOSS',
            ),
            logger,
        ),
);

const articleFabricationAgentFactory = Injectable(
    'ArticleFabricationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleFabricationAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gptOSS',
            ),
            logger,
        ),
);

const articleQuizGenerationAgentFactory = Injectable(
    'ArticleQuizGenerationAgent',
    ['Models', 'Configuration', 'Logger'] as const,
    (models: ModelsPort, config: ConfigurationPort, logger: LoggerPort) =>
        new ArticleQuizGenerationAgent(
            selectModelByBudget(
                models,
                config.getOutboundConfiguration().openRouter.budget,
                'gptOSS',
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
    (db: PrismaDatabase, logger: LoggerPort) => {
        logger.info('Initializing Article repository', { repository: 'PrismaArticle' });
        const articleRepository = new PrismaArticleRepository(db);
        return articleRepository;
    },
);

const reportRepositoryFactory = Injectable(
    'ReportRepository',
    ['Database', 'Logger'] as const,
    (db: PrismaDatabase, logger: LoggerPort) => {
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
    ['ReportIngestionAgent', 'Logger', 'News', 'ReportRepository'] as const,
    (
        reportIngestionAgent: ReportIngestionAgentPort,
        logger: LoggerPort,
        newsService: NewsProviderPort,
        reportRepository: ReportRepositoryPort,
    ) => new IngestReportsUseCase(reportIngestionAgent, logger, newsService, reportRepository),
);

const deduplicateReportsUseCaseFactory = Injectable(
    'DeduplicateReports',
    ['ReportDeduplicationAgent', 'Logger', 'ReportRepository'] as const,
    (
        reportDeduplicationAgent: ReportDeduplicationAgentPort,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
    ) => new DeduplicateReportsUseCase(reportDeduplicationAgent, logger, reportRepository),
);

const publishReportsUseCaseFactory = Injectable(
    'PublishReports',
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
        new PublishReportsUseCase(
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
        'DeduplicateReports',
        'PublishReports',
        'GenerateArticleChallenges',
        'ClassifyReports',
        'Configuration',
        'Logger',
    ] as const,
    (
        ingestReports: IngestReportsUseCase,
        deduplicateReports: DeduplicateReportsUseCase,
        publishReports: PublishReportsUseCase,
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
                deduplicateReports,
                publishReports,
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

        logger.info('Initializing NewRelic monitoring', { provider: 'NewRelic' });
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
    Injectable('Configuration', () => new NodeConfig(nodeConfiguration, overrides));

const serverFactory = Injectable(
    'Server',
    ['Logger', 'Controllers'] as const,
    (logger: LoggerPort, controllers: { getArticles: GetArticlesController }): ServerPort => {
        logger.info('Initializing Server', { implementation: 'Hono' });
        const server = new HonoServer(logger, controllers.getArticles);
        return server;
    },
);

const workerFactory = Injectable(
    'Worker',
    ['Logger', 'Tasks'] as const,
    (logger: LoggerPort, tasks: TaskPort[]): WorkerPort => {
        logger.info('Initializing Worker', { implementation: 'NodeCron' });
        const worker = new NodeCron(logger, tasks);
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
        .provides(deduplicateReportsUseCaseFactory)
        .provides(publishReportsUseCaseFactory)
        .provides(generateArticleChallengesUseCaseFactory)
        .provides(classifyReportsUseCaseFactory)
        // Controllers and tasks
        .provides(controllersFactory)
        .provides(tasksFactory)
        // Inbound adapters
        .provides(serverFactory)
        .provides(workerFactory);
