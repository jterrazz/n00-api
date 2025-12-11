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

// Infrastructure
import type { PrismaDatabase } from '../../src/infrastructure/outbound/persistence/prisma.database.js';

import { createContainer } from '../../src/di/container.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

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

    // Create the database schema BEFORE container initialization
    // This ensures the better-sqlite3 adapter opens an existing file in read/write mode
    execSync('npx prisma db push --force-reset', {
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
        },
        stdio: 'ignore',
    });

    const testContainer = createContainer({ databaseUrl });
    const { level } = testContainer.get('Configuration').getInboundConfiguration().logger;

    const server = testContainer.get('Server');
    const worker = testContainer.get('Worker');
    const tasks = testContainer.get('Tasks');
    const database = testContainer.get('Database') as PrismaDatabase;
    const msw = setupServer(...handlers);
    const prisma = database.getPrismaClient();

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

    // Close MSW (database file cleanup is done in afterAll, not here)
    context.msw.close();

    context._internal.started = false;
}

/**
 * Clean up temporary database file. Should be called in afterAll.
 */
export async function cleanupIntegrationContext(context: IntegrationContext): Promise<void> {
    try {
        unlinkSync(context._internal.databasePath);
    } catch (err) {
        console.debug('Could not delete SQLite file:', err);
    }
}
