import { type ModelPort, OpenRouterAdapter } from '@jterrazz/intelligence';
import { type LoggerPort, PinoLoggerAdapter } from '@jterrazz/logger';
import {
    type MonitoringPort,
    NewRelicMonitoringAdapter,
    NoopMonitoringAdapter,
} from '@jterrazz/monitoring';
import { Container, Injectable } from '@snap/ts-inject';
import { default as nodeConfiguration } from 'config';

import type { ConfigurationPort } from '../application/ports/inbound/configuration.port.js';

import type { ExecutorPort } from '../application/ports/inbound/executor.port.js';
import { type TaskPort } from '../application/ports/inbound/executor.port.js';
import type { ServerPort } from '../application/ports/inbound/server.port.js';
import { type ArticleComposerAgentPort } from '../application/ports/outbound/agents/article-composer.agent.js';
import { type StoryClassifierAgentPort } from '../application/ports/outbound/agents/story-classifier.agent.js';
import { type StoryDeduplicationAgentPort } from '../application/ports/outbound/agents/story-deduplication.agent.js';
import { type StoryDigestAgentPort } from '../application/ports/outbound/agents/story-digest.agent.js';
import type { ArticleRepositoryPort } from '../application/ports/outbound/persistence/article-repository.port.js';
import { type StoryRepositoryPort } from '../application/ports/outbound/persistence/story-repository.port.js';
import type { NewsProviderPort } from '../application/ports/outbound/providers/news.port.js';
import { GenerateArticlesFromStoriesUseCase } from '../application/use-cases/articles/generate-articles-from-stories.use-case.js';
import { GetArticlesUseCase } from '../application/use-cases/articles/get-articles.use-case.js';
import { ClassifyStoriesUseCase } from '../application/use-cases/stories/classify-stories.use-case.js';
import { DigestStoriesUseCase } from '../application/use-cases/stories/digest-stories.use-case.js';

import { NodeConfigAdapter } from '../infrastructure/inbound/configuration/node-config.adapter.js';
import { NodeCronAdapter } from '../infrastructure/inbound/executor/node-cron.adapter.js';
import { StoryDigestTask } from '../infrastructure/inbound/executor/stories/story-digest.task.js';
import { GetArticlesController } from '../infrastructure/inbound/server/articles/get-articles.controller.js';
import { HonoServerAdapter } from '../infrastructure/inbound/server/hono.adapter.js';
import { ArticleComposerAgentAdapter } from '../infrastructure/outbound/agents/article-composer.agent.js';
import { StoryClassifierAgentAdapter } from '../infrastructure/outbound/agents/story-classifier.agent.js';
import { StoryDeduplicationAgentAdapter } from '../infrastructure/outbound/agents/story-deduplication.agent.js';
import { StoryDigestAgentAdapter } from '../infrastructure/outbound/agents/story-digest.agent.js';
import { PrismaAdapter } from '../infrastructure/outbound/persistence/prisma.adapter.js';
import { PrismaArticleRepository } from '../infrastructure/outbound/persistence/prisma-article.adapter.js';
import { PrismaStoryRepository } from '../infrastructure/outbound/persistence/prisma-story.adapter.js';
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
        logger.info('Initializing WorldNews adapter');
        const newsAdapter = new WorldNewsAdapter(
            {
                apiKey: config.getOutboundConfiguration().worldNews.apiKey,
            },
            logger,
            monitoring,
        );
        const useCache = config.getOutboundConfiguration().worldNews.useCache;

        if (useCache) {
            logger.info('Initializing CachedNews adapter');
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

const modelFactory = Injectable(
    'Model',
    ['Configuration'] as const,
    (config: ConfigurationPort): ModelPort =>
        new OpenRouterAdapter({
            apiKey: config.getOutboundConfiguration().openRouter.apiKey,
            metadata: {
                application: 'jterrazz-agents',
                website: 'https://jterrazz.com',
            },
            modelName:
                config.getOutboundConfiguration().openRouter.budget === 'low'
                    ? 'google/gemini-2.5-flash-lite-preview-06-17'
                    : 'google/gemini-2.5-flash',
        }),
);

const storyDigestAgentFactory = Injectable(
    'StoryDigestAgent',
    ['Model', 'Logger'] as const,
    (model: ModelPort, logger: LoggerPort) => new StoryDigestAgentAdapter(model, logger),
);

const articleComposerAgentFactory = Injectable(
    'ArticleComposerAgent',
    ['Model', 'Logger'] as const,
    (model: ModelPort, logger: LoggerPort) => new ArticleComposerAgentAdapter(model, logger),
);

const storyClassifierAgentFactory = Injectable(
    'StoryClassifierAgent',
    ['Model', 'Logger'] as const,
    (model: ModelPort, logger: LoggerPort) => new StoryClassifierAgentAdapter(model, logger),
);

const storyDeduplicationAgentFactory = Injectable(
    'StoryDeduplicationAgent',
    ['Model', 'Logger'] as const,
    (model: ModelPort, logger: LoggerPort) => new StoryDeduplicationAgentAdapter(model, logger),
);

/**
 * Repository adapters
 */
const articleRepositoryFactory = Injectable(
    'ArticleRepository',
    ['Database', 'Logger'] as const,
    (db: PrismaAdapter, logger: LoggerPort) => {
        logger.info('Initializing Prisma article repository');
        const articleRepository = new PrismaArticleRepository(db);
        return articleRepository;
    },
);

const storyRepositoryFactory = Injectable(
    'StoryRepository',
    ['Database', 'Logger'] as const,
    (db: PrismaAdapter, logger: LoggerPort) => {
        logger.info('Initializing Prisma story repository');
        const storyRepository = new PrismaStoryRepository(db, logger);
        return storyRepository;
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

const digestStoriesUseCaseFactory = Injectable(
    'DigestStories',
    ['StoryDigestAgent', 'StoryDeduplicationAgent', 'Logger', 'News', 'StoryRepository'] as const,
    (
        storyDigestAgent: StoryDigestAgentPort,
        storyDeduplicationAgent: StoryDeduplicationAgentPort,
        logger: LoggerPort,
        newsService: NewsProviderPort,
        storyRepository: StoryRepositoryPort,
    ) =>
        new DigestStoriesUseCase(
            storyDigestAgent,
            storyDeduplicationAgent,
            logger,
            newsService,
            storyRepository,
        ),
);

const generateArticlesFromStoriesUseCaseFactory = Injectable(
    'GenerateArticlesFromStories',
    ['ArticleComposerAgent', 'Logger', 'StoryRepository', 'ArticleRepository'] as const,
    (
        articleComposerAgent: ArticleComposerAgentPort,
        logger: LoggerPort,
        storyRepository: StoryRepositoryPort,
        articleRepository: ArticleRepositoryPort,
    ) =>
        new GenerateArticlesFromStoriesUseCase(
            articleComposerAgent,
            logger,
            storyRepository,
            articleRepository,
        ),
);

const classifyStoriesUseCaseFactory = Injectable(
    'ClassifyStories',
    ['StoryClassifierAgent', 'StoryRepository', 'Logger'] as const,
    (
        storyClassifierAgent: StoryClassifierAgentPort,
        storyRepository: StoryRepositoryPort,
        logger: LoggerPort,
    ) => new ClassifyStoriesUseCase(storyClassifierAgent, storyRepository, logger),
);

/**
 * Controller factories
 */
const getArticlesControllerFactory = Injectable(
    'GetArticlesController',
    ['GetArticles'] as const,
    (getArticles: GetArticlesUseCase) => new GetArticlesController(getArticles),
);

/**
 * Task factories
 */
const tasksFactory = Injectable(
    'Tasks',
    [
        'DigestStories',
        'GenerateArticlesFromStories',
        'ClassifyStories',
        'Configuration',
        'Logger',
    ] as const,
    (
        digestStories: DigestStoriesUseCase,
        generateArticlesFromStories: GenerateArticlesFromStoriesUseCase,
        classifyStories: ClassifyStoriesUseCase,
        configuration: ConfigurationPort,
        logger: LoggerPort,
    ): TaskPort[] => {
        const tasks: TaskPort[] = [];

        // Story digest task
        const storyDigestConfigs = configuration.getInboundConfiguration().tasks.storyDigest;
        tasks.push(
            new StoryDigestTask(
                digestStories,
                generateArticlesFromStories,
                classifyStories,
                storyDigestConfigs,
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

        logger.info('Initializing NewRelic adapter');
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
    ['Logger', 'GetArticlesController'] as const,
    (logger: LoggerPort, getArticlesController: GetArticlesController): ServerPort => {
        logger.info('Initializing Hono server');
        const server = new HonoServerAdapter(logger, getArticlesController);
        return server;
    },
);

const executorFactory = Injectable(
    'Executor',
    ['Logger', 'Tasks'] as const,
    (logger: LoggerPort, tasks: TaskPort[]): ExecutorPort => {
        logger.info('Initializing NodeCron executor');
        const executor = new NodeCronAdapter(logger, tasks);
        return executor;
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
        .provides(modelFactory)
        .provides(storyDigestAgentFactory)
        .provides(articleComposerAgentFactory)
        .provides(storyClassifierAgentFactory)
        .provides(storyDeduplicationAgentFactory)
        // Repositories
        .provides(articleRepositoryFactory)
        .provides(storyRepositoryFactory)
        // Use cases
        .provides(getArticlesUseCaseFactory)
        .provides(digestStoriesUseCaseFactory)
        .provides(generateArticlesFromStoriesUseCaseFactory)
        .provides(classifyStoriesUseCaseFactory)
        // Controllers and tasks
        .provides(getArticlesControllerFactory)
        .provides(tasksFactory)
        // Inbound adapters
        .provides(serverFactory)
        .provides(executorFactory);
