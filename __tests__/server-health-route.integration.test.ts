import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    cleanupIntegrationContext,
    createIntegrationContext,
    executeRequest,
    type IntegrationContext,
    startIntegrationContext,
    stopIntegrationContext,
} from './setup/integration.js';

/**
 * Integration test for the /health server route.
 * Ensures the service responds with HTTP 200 and plain 'OK' text, verifying basic liveness.
 */
describe('Server /health route – integration', () => {
    let integrationContext: IntegrationContext;

    beforeAll(async () => {
        integrationContext = await createIntegrationContext();
    });

    afterAll(async () => {
        await cleanupIntegrationContext(integrationContext);
    });

    beforeEach(async () => {
        await startIntegrationContext(integrationContext);
    });

    afterEach(async () => {
        await stopIntegrationContext(integrationContext);
    });

    it('should return OK status for the root route', async () => {
        // When
        const response = await executeRequest(integrationContext, '/');

        // Then
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('OK');
    });
});
