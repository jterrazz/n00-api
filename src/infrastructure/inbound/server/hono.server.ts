import { serve } from '@hono/node-server';
import { type LoggerPort } from '@jterrazz/logger';
import { Hono } from 'hono';

// Application
import {
    type ServerConfiguration,
    type ServerPort,
} from '../../../application/ports/inbound/server.port.js';

import { createArticlesRouter } from './articles/articles.routes.js';
import { type GetArticlesController } from './articles/get-articles.controller.js';
import { createErrorHandlerMiddleware } from './error-handler.middleware.js';
import { createHealthRouter } from './health/health.routes.js';

export class HonoServer implements ServerPort {
    private app: Hono;
    private server: null | ReturnType<typeof serve> = null;

    constructor(
        private readonly logger: LoggerPort,
        private readonly getArticlesController: GetArticlesController,
    ) {
        this.app = new Hono();
        this.setupGlobalMiddleware();
        this.registerRoutes();
    }

    public async request(
        path: string,
        options?: { body?: object | string; headers?: Record<string, string>; method?: string },
    ): Promise<Response> {
        const init: RequestInit = {
            body: options?.body ? JSON.stringify(options.body) : undefined,
            headers: options?.headers,
            method: options?.method,
        };
        return this.app.request(path, init);
    }

    public async start(config: ServerConfiguration): Promise<void> {
        return new Promise((resolve) => {
            this.logger.debug('Starting server', { host: config.host, port: config.port });

            this.server = serve(this.app, (info) => {
                this.logger.debug('Server listening', { host: config.host, port: info.port });
                resolve();
            });
        });
    }

    public async stop(): Promise<void> {
        if (!this.server) return;

        this.logger.info('Stopping server');
        await this.server.close();
        this.server = null;
        this.logger.info('Server stopped');
    }

    private registerRoutes(): void {
        this.app.route('/', createHealthRouter());
        this.app.route('/articles', createArticlesRouter(this.getArticlesController));
    }

    private setupGlobalMiddleware(): void {
        this.app.onError(createErrorHandlerMiddleware(this.logger));
    }
}
