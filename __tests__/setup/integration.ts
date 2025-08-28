import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'msw';
import { setupServer, type SetupServerApi } from 'msw/node';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';

// Application
import { type ServerPort } from '../../src/application/ports/inbound/server.port.js';
import { type TaskPort, type WorkerPort } from '../../src/application/ports/inbound/worker.port.js';

import { createContainer } from '../../src/di/container.js';

export type IntegrationContext = {
    _internal: { databasePath: string; databaseUrl: string; logLevel: string; started: boolean };
    gateways: {
        httpServer: ServerPort;
        tasks: TaskPort[];
        worker: WorkerPort;
    };
    msw: SetupServerApi;
    prisma: PrismaClient;
};

export async function createIntegrationContext(
    handlers: RequestHandler[] = [],
): Promise<IntegrationContext> {
    const databaseFile = `test-${randomUUID()}.sqlite`;
    const databasePath = resolve(os.tmpdir(), databaseFile);
    const databaseUrl = `file:${databasePath}`;
    const testContainer = createContainer({ databaseUrl });
    const { level } = testContainer.get('Configuration').getInboundConfiguration().logger;

    const server = testContainer.get('Server');
    const worker = testContainer.get('Worker');
    const tasks = testContainer.get('Tasks');
    const msw = setupServer(...handlers);
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    return {
        _internal: { databasePath, databaseUrl, logLevel: level, started: false },
        gateways: { httpServer: server, tasks: tasks, worker: worker },
        msw,
        prisma,
    };
}

/**
 * Convenience wrapper to issue HTTP requests against the server in the integration context.
 *
 * @param context Integration context
 * @param path Request path (e.g., '/articles')
 * @param options Optional request init
 */
export async function executeRequest(
    context: IntegrationContext,
    path: string,
    options?: { body?: object | string; headers?: Record<string, string>; method?: string },
): Promise<Response> {
    return context.gateways.httpServer.request(path, options);
}

/**
 * Execute a background task by name within the integration context.
 * Throws if the task name is not registered.
 */
export async function executeTask(context: IntegrationContext, taskName: string): Promise<void> {
    const task = context.gateways.tasks.find((t) => t.name === taskName);
    if (!task) {
        throw new Error(`Task '${taskName}' not found in integration context.`);
    }
    await task.execute();
}

export async function startIntegrationContext(context: IntegrationContext): Promise<void> {
    if (context._internal.started) {
        throw new Error('Integration context already started.');
    }

    // Push prisma schema to the temporary database, ensuring fresh state
    execSync('npx prisma db push --force-reset --skip-generate', {
        env: { ...process.env, DATABASE_URL: context._internal.databaseUrl },
        stdio: context._internal.logLevel === 'silent' ? 'ignore' : 'inherit',
    });

    context.msw.listen({ onUnhandledRequest: 'warn' });

    // Clean database – order matters due to FK constraints
    await context.prisma.article.deleteMany();
    await context.prisma.report.deleteMany();

    context._internal.started = true;
}

export async function stopIntegrationContext(context: IntegrationContext): Promise<void> {
    if (!context._internal.started) {
        throw new Error('Integration context has not been started.');
    }

    // Stop components started in startIntegrationContext
    await context.gateways.worker.stop();

    // Disconnect Prisma and MSW & remove temporary DB
    await context.prisma.$disconnect();
    context.msw.close();

    try {
        unlinkSync(context._internal.databasePath);
    } catch (err) {
        console.debug('Could not delete SQLite file:', err);
    }

    context._internal.started = false;
}
