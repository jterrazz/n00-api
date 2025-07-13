import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    cleanupIntegrationTest,
    type IntegrationTestContext,
    setupIntegrationTest,
} from './setup/integration.js';

describe('Server /health route – integration', () => {
    let testContext: IntegrationTestContext;

    beforeAll(async () => {
        testContext = await setupIntegrationTest();
    });

    afterAll(async () => {
        await cleanupIntegrationTest(testContext);
    });

    it('should return OK status for the root route', async () => {
        // Given
        const { httpServer } = testContext.gateways;

        // When
        const response = await httpServer.request('/');

        // Then
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('OK');
    });
});
