import { type LoggerPort } from '@jterrazz/logger';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Application
import { type DatabasePort } from '../../../application/ports/outbound/persistence/database.port.js';

import { PrismaClient } from '../../../generated/prisma/client.js';

export class PrismaDatabase implements DatabasePort {
    private client: PrismaClient;

    constructor(
        private readonly logger: LoggerPort,
        databaseUrl: string,
    ) {
        this.logger.info('Configuring Prisma client', { databaseUrl });

        const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

        this.client = new PrismaClient({
            adapter,
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
