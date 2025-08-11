import { type LoggerPort } from '@jterrazz/logger';
import { type Prisma, PrismaClient } from '@prisma/client';

import { type DatabasePort } from '../../../application/ports/outbound/persistence/database.port.js';

export class PrismaDatabase implements DatabasePort {
    private client: PrismaClient;

    constructor(
        private readonly logger: LoggerPort,
        databaseUrl: string,
    ) {
        this.logger.info('Configuring Prisma client', { databaseUrl });
        this.client = new PrismaClient({
            datasources: {
                db: {
                    url: databaseUrl,
                },
            },
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'info' },
                { emit: 'event', level: 'warn' },
            ],
        });

        this.client.$on('error' as never, (event: Prisma.LogEvent) => {
            this.logger.error('Prisma emitted an error', { ...event });
        });
        this.client.$on('warn' as never, (event: Prisma.LogEvent) => {
            this.logger.warn('Prisma emitted a warning', { ...event });
        });
        this.client.$on('info' as never, (event: Prisma.LogEvent) => {
            this.logger.info('Prisma info', { ...event });
        });
        this.client.$on('query' as never, (event: Prisma.LogEvent) => {
            this.logger.debug('Prisma query executed', { ...event });
        });
    }

    async connect(): Promise<void> {
        this.logger.info('Connecting to database via Prisma Client');
        await this.client.$connect();
    }

    async disconnect(): Promise<void> {
        await this.client.$disconnect();
    }

    getPrismaClient(): PrismaClient {
        return this.client;
    }
}
