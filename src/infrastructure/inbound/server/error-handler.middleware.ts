import type { LoggerPort } from '@jterrazz/logger';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Creates a global error handling middleware for Hono
 * Catches all unhandled errors and returns appropriate HTTP responses
 */
export const createErrorHandlerMiddleware = (logger: LoggerPort) => {
    return async (err: Error, c: Context) => {
        logger.error('Unexpected error in HTTP handler:', { error: err.message, stack: err.stack });

        // Handle HTTP exceptions (like validation errors)
        if (err instanceof HTTPException) {
            return c.json({ error: err.message }, err.status);
        }

        // Handle all other errors as 500 Internal Server Error
        return c.json(
            {
                error: err instanceof Error ? err.message : 'Internal server error',
            },
            500,
        );
    };
};
