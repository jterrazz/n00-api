import { type LoggerLevel } from '@jterrazz/logger';

// Domain
import { type CountryEnum } from '../../../domain/value-objects/country.vo.js';
import { type LanguageEnum } from '../../../domain/value-objects/language.vo.js';

/**
 * Configuration port providing access to application settings
 */
export interface ConfigurationPort {
    /**
     * Get the inbound configuration
     */
    getInboundConfiguration(): InboundConfigurationPort;

    /**
     * Get the outbound configuration
     */
    getOutboundConfiguration(): OutboundConfigurationPort;
}

/**
 * Inbound configuration (defined by the user)
 */
export interface InboundConfigurationPort {
    env: 'development' | 'production' | 'test';
    http: {
        host: string;
        port: number;
    };
    logger: {
        level: LoggerLevel;
        prettyPrint: boolean;
    };
    tasks: {
        reportPipeline: ReportPipelineTaskConfig[];
    };
}

/**
 * Outbound configuration (defined by external services)
 */
export interface OutboundConfigurationPort {
    agents: {
        reportIngestion: string;
        reportDeduplication: string;
        reportClassification: string;
        articleComposition: string;
        articleFabrication: string;
        articleQuizGeneration: string;
    };
    newRelic: {
        enabled: boolean;
        licenseKey?: string;
    };
    openRouter: {
        apiKey: string;
    };
    prisma: {
        databaseUrl: string;
    };
    worldNews: {
        apiKey: string;
        useCache: boolean;
    };
}

/**
 * Report pipeline task configuration
 */
export interface ReportPipelineTaskConfig {
    country: CountryEnum;
    language: LanguageEnum;
}

/**
 * Tasks configuration
 */
export interface TasksConfigurationPort {
    reportPipeline: ReportPipelineTaskConfig[];
}
