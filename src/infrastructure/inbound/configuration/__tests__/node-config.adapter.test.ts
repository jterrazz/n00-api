import { describe, expect, test } from '@jterrazz/test';
import { ZodError } from 'zod/v4';

import { NodeConfig } from '../node-config.js';

describe('Node Config', () => {
    const validConfig = {
        inbound: {
            env: 'development',
            http: {
                host: 'localhost',
                port: 3000,
            },
            logger: {
                level: 'info',
                prettyPrint: false,
            },
            tasks: {
                reportPipeline: [
                    {
                        country: 'FR',
                        language: 'FR',
                    },
                    {
                        country: 'US',
                        language: 'EN',
                    },
                ],
            },
        },
        outbound: {
            newRelic: {
                enabled: false,
            },
            openRouter: {
                apiKey: 'test-openrouter-key',
                budget: 'low',
            },
            prisma: {
                databaseUrl: 'file:./database/test.sqlite',
            },
            worldNews: {
                apiKey: 'test-world-news-key',
                useCache: false,
            },
        },
    };

    test('should load valid configuration', () => {
        // Given - a valid configuration object
        // When - creating a NodeConfig instance
        const config = new NodeConfig(validConfig);
        // Then - it should return the correct inbound and outbound configuration
        expect(config.getInboundConfiguration()).toEqual(validConfig.inbound);
        expect(config.getOutboundConfiguration()).toEqual(validConfig.outbound);
    });

    test('should load configuration with default empty reportPipeline when not provided', () => {
        // Given - a valid configuration without reportPipeline tasks
        const configWithoutTasks = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                tasks: {
                    reportPipeline: undefined,
                },
            },
        };
        // When - creating a NodeConfig instance
        const config = new NodeConfig(configWithoutTasks);
        // Then - it should return configuration with empty reportPipeline array
        expect(config.getInboundConfiguration().tasks.reportPipeline).toEqual([]);
    });

    test('should fail with invalid environment', () => {
        // Given - a configuration with an invalid environment
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                env: 'invalid-env',
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with missing API keys', () => {
        // Given - a configuration with missing API keys
        const invalidConfig = {
            ...validConfig,
            outbound: {
                ...validConfig.outbound,
                worldNews: { apiKey: '' },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with invalid port', () => {
        // Given - a configuration with an invalid port
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                http: {
                    ...validConfig.inbound.http,
                    port: 'invalid-port',
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with invalid log level', () => {
        // Given - a configuration with an invalid log level
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                logger: {
                    ...validConfig.inbound.logger,
                    level: 'invalid-level',
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with missing host', () => {
        // Given - a configuration with missing host in http
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                http: {
                    port: 3000,
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with missing tasks configuration', () => {
        // Given - a configuration with missing tasks
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                tasks: undefined,
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with invalid report pipeline task configuration', () => {
        // Given - a configuration with invalid task configuration
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                tasks: {
                    reportPipeline: [
                        {
                            country: '', // Invalid empty country
                            language: 'FR',
                        },
                    ],
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with invalid country in report pipeline task', () => {
        // Given - a configuration with invalid country
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                tasks: {
                    reportPipeline: [
                        {
                            country: 'invalid-country',
                            language: 'EN',
                        },
                    ],
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });

    test('should fail with invalid language in report pipeline task', () => {
        // Given - a configuration with invalid language
        const invalidConfig = {
            ...validConfig,
            inbound: {
                ...validConfig.inbound,
                tasks: {
                    reportPipeline: [
                        {
                            country: 'US',
                            language: 'INVALID',
                        },
                    ],
                },
            },
        };
        // When/Then - creating a NodeConfig should throw a ZodError
        expect(() => new NodeConfig(invalidConfig)).toThrow(ZodError);
    });
});
