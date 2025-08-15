import { LoggerLevelSchema } from '@jterrazz/logger';
import { z } from 'zod/v4';

// Configuration
import {
    type ConfigurationPort,
    type InboundConfigurationPort,
    type OutboundConfigurationPort,
} from '../../../application/ports/inbound/configuration.port.js';

// Domain
import { countrySchema } from '../../../domain/value-objects/country.vo.js';
import { languageSchema } from '../../../domain/value-objects/language.vo.js';

const configurationSchema = z.object({
    inbound: z.object({
        env: z.enum(['development', 'production', 'test']),
        http: z.object({
            host: z.string(),
            port: z.coerce.number().int().positive(),
        }),
        logger: z.object({
            level: LoggerLevelSchema,
            prettyPrint: z.boolean(),
        }),
        tasks: z.object({
            reportPipeline: z
                .array(
                    z.object({
                        country: countrySchema,
                        language: languageSchema,
                    }),
                )
                .optional()
                .default([]),
        }),
    }),
    outbound: z.object({
        agents: z.object({
            reportIngestion: z.string().min(1),
            reportDeduplication: z.string().min(1),
            reportClassification: z.string().min(1),
            articleComposition: z.string().min(1),
            articleFabrication: z.string().min(1),
            articleQuizGeneration: z.string().min(1),
        }),
        newRelic: z.object({
            enabled: z.boolean(),
            licenseKey: z.string().optional(),
        }),
        openRouter: z.object({
            apiKey: z.string().min(1),
        }),
        prisma: z.object({
            databaseUrl: z.string().min(1),
        }),
        worldNews: z.object({
            apiKey: z.string().min(1),
            useCache: z.coerce.boolean(),
        }),
    }),
});

type Configuration = z.infer<typeof configurationSchema>;

/**
 * Node.js configuration loader backed by node-config
 */
export class NodeConfig implements ConfigurationPort {
    private readonly configuration: Configuration;

    constructor(configurationInput: unknown, overrides?: { databaseUrl?: string }) {
        // Parse and validate first
        const parsed = configurationSchema.parse(configurationInput);

        // Apply override after parsing
        if (overrides?.databaseUrl) {
            parsed.outbound.prisma.databaseUrl = overrides.databaseUrl;
        }

        this.configuration = parsed;
    }

    public getInboundConfiguration(): InboundConfigurationPort {
        return this.configuration.inbound;
    }

    public getOutboundConfiguration(): OutboundConfigurationPort {
        return this.configuration.outbound;
    }
}
