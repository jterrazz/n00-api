import { OpenRouterProvider, type ProviderPort } from '@jterrazz/intelligence';
import { type LoggerPort, PinoLoggerAdapter } from '@jterrazz/logger';
import {
    type MonitoringPort,
    NewRelicMonitoringAdapter,
    NoopMonitoringAdapter,
} from '@jterrazz/monitoring';
import { Container, Injectable } from '@snap/ts-inject';
import { default as nodeConfiguration } from 'config';

// Configuration
import type { ConfigurationPort } from '../application/ports/inbound/configuration.port.js';
import { NodeConfig } from '../infrastructure/inbound/configuration/node-config.js';

// Application
import type { ServerPort } from '../application/ports/inbound/server.port.js';
import type { TaskPort, WorkerPort } from '../application/ports/inbound/worker.port.js';
import type { ArticleRepositoryPort } from '../application/ports/outbound/persistence/article/article-repository.port.js';
import { type ReportRepositoryPort } from '../application/ports/outbound/persistence/report/report-repository.port.js';
import type { NewsProviderPort } from '../application/ports/outbound/providers/news.port.js';
import { FabricateArticlesUseCase } from '../application/use-cases/articles/fabricate-articles.use-case.js';
import { GenerateArticleChallengesUseCase } from '../application/use-cases/articles/generate-article-challenges.use-case.js';
import { GetArticlesUseCase } from '../application/use-cases/articles/get-articles.use-case.js';
import { ClassifyReportsUseCase } from '../application/use-cases/reports/classify-reports.use-case.js';
import { DeduplicateReportsUseCase } from '../application/use-cases/reports/deduplicate-reports.use-case.js';
import { IngestReportsUseCase } from '../application/use-cases/reports/ingest-reports.use-case.js';
import { PublishReportsUseCase } from '../application/use-cases/reports/publish-reports.use-case.js';

// Infrastructure
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
                application: 'news-ai',
            },
        }),
);

/**
 * Agent factories
 */
const agentFactory = Injectable(
    'Agents',
    ['Provider', 'Configuration', 'Logger'] as const,
    (provider: ProviderPort, config: ConfigurationPort, logger: LoggerPort) => {
        const agentConfig = config.getOutboundConfiguration().agents;

        const getModel = (modelName: string) => provider.getModel(modelName);

        return {
            reportIngestion: new ReportIngestionAgent(
                getModel(agentConfig.reportIngestion),
                logger,
            ),
            reportDeduplication: new ReportDeduplicationAgent(
                getModel(agentConfig.reportDeduplication),
                logger,
            ),
            reportClassification: new ReportClassificationAgent(
                getModel(agentConfig.reportClassification),
                logger,
            ),
            articleComposition: new ArticleCompositionAgent(
                getModel(agentConfig.articleComposition),
                logger,
            ),
            articleFabrication: new ArticleFabricationAgent(
                getModel(agentConfig.articleFabrication),
                logger,
            ),
            articleQuizGeneration: new ArticleQuizGenerationAgent(
                getModel(agentConfig.articleQuizGeneration),
                logger,
            ),
        };
    },
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

const fabricateArticlesUseCaseFactory = Injectable(
    'FabricateArticles',
    ['Agents', 'ArticleRepository', 'Logger'] as const,
    (
        agents: ReturnType<typeof agentFactory>,
        articleRepository: ArticleRepositoryPort,
        logger: LoggerPort,
    ) => new FabricateArticlesUseCase(agents.articleFabrication, articleRepository, logger),
);

const ingestReportsUseCaseFactory = Injectable(
    'IngestReports',
    ['Agents', 'Logger', 'News', 'ReportRepository'] as const,
    (
        agents: ReturnType<typeof agentFactory>,
        logger: LoggerPort,
        newsService: NewsProviderPort,
        reportRepository: ReportRepositoryPort,
    ) => new IngestReportsUseCase(agents.reportIngestion, logger, newsService, reportRepository),
);

const deduplicateReportsUseCaseFactory = Injectable(
    'DeduplicateReports',
    ['Agents', 'Logger', 'ReportRepository'] as const,
    (
        agents: ReturnType<typeof agentFactory>,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
    ) => new DeduplicateReportsUseCase(agents.reportDeduplication, logger, reportRepository),
);

const publishReportsUseCaseFactory = Injectable(
    'PublishReports',
    ['Agents', 'FabricateArticles', 'Logger', 'ReportRepository', 'ArticleRepository'] as const,
    (
        agents: ReturnType<typeof agentFactory>,
        fabricateArticles: FabricateArticlesUseCase,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
        articleRepository: ArticleRepositoryPort,
    ) =>
        new PublishReportsUseCase(
            agents.articleComposition,
            fabricateArticles,
            logger,
            reportRepository,
            articleRepository,
        ),
);

const classifyReportsUseCaseFactory = Injectable(
    'ClassifyReports',
    ['Agents', 'Logger', 'ReportRepository'] as const,
    (
        agents: ReturnType<typeof agentFactory>,
        logger: LoggerPort,
        reportRepository: ReportRepositoryPort,
    ) => new ClassifyReportsUseCase(agents.reportClassification, logger, reportRepository),
);

const generateArticleChallengesUseCaseFactory = Injectable(
    'GenerateArticleChallenges',
    ['ArticleRepository', 'Agents', 'Logger'] as const,
    (
        articleRepository: ArticleRepositoryPort,
        agents: ReturnType<typeof agentFactory>,
        logger: LoggerPort,
    ) =>
        new GenerateArticleChallengesUseCase(
            articleRepository,
            agents.articleQuizGeneration,
            logger,
        ),
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
        .provides(agentFactory)
        // Repositories
        .provides(articleRepositoryFactory)
        .provides(reportRepositoryFactory)
        // Use cases
        .provides(getArticlesUseCaseFactory)
        .provides(fabricateArticlesUseCaseFactory)
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
