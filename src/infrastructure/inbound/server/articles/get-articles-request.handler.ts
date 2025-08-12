import { HTTPException } from 'hono/http-exception';
import { z } from 'zod/v4';

import { Category, categorySchema } from '../../../../domain/value-objects/category.vo.js';
import { Country, countrySchema } from '../../../../domain/value-objects/country.vo.js';
import { Language, languageSchema } from '../../../../domain/value-objects/language.vo.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Raw HTTP query parameters from the request
 */
export interface GetArticlesHttpQuery {
    category?: string;
    country?: string;
    cursor?: string;
    ids?: string | string[];
    language?: string;
    limit?: string;
}

/**
 * Validates and transforms a category string to a Category domain object
 */
const categoryParamSchema = z
    .string()
    .optional()
    .transform((val) => val?.toUpperCase())
    .pipe(categorySchema.optional())
    .transform((val) => (val ? new Category(val) : undefined));

/**
 * Validates and transforms a country string to a Country domain object
 * Defaults to 'us' if not specified
 */
const countryParamSchema = z
    .string()
    .optional()
    .transform((val) => val?.toUpperCase() || 'US') // Default to 'US' if not provided
    .pipe(countrySchema)
    .transform((val) => new Country(val));

/**
 * Validates and transforms a language string to a Language domain object
 */
const languageParamSchema = z
    .string()
    .optional()
    .transform((val) => val?.toUpperCase())
    .pipe(languageSchema.optional())
    .transform((val) => (val ? new Language(val) : undefined));

/**
 * Validates and transforms a cursor string to a Date object
 */
const cursorParamSchema = z
    .string()
    .optional()
    .refine(
        (cursor) => {
            if (!cursor) return true;

            try {
                const decodedString = Buffer.from(cursor, 'base64').toString();
                const timestamp = Number(decodedString);
                return !isNaN(timestamp);
            } catch {
                return false;
            }
        },
        {
            message: 'Invalid cursor format',
        },
    )
    .transform((cursor) => {
        if (!cursor) return undefined;

        const decodedString = Buffer.from(cursor, 'base64').toString();
        const timestamp = Number(decodedString);
        return new Date(timestamp);
    });

/**
 * Validates and transforms limit parameter with default value
 */
const limitParamSchema = z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
        if (val === undefined) return DEFAULT_PAGE_SIZE;
        return typeof val === 'string' ? Number(val) : val;
    })
    .pipe(z.number().min(1).max(MAX_PAGE_SIZE));

/**
 * Schema for validating HTTP input parameters for GET /articles endpoint
 * Transforms raw input directly to domain value objects
 */
const getArticlesParamsSchema = z.object({
    category: categoryParamSchema,
    country: countryParamSchema,
    cursor: cursorParamSchema,
    ids: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : v.split(',')))
        .transform((arr) => arr?.map((id) => id.trim()).filter((id) => id.length > 0))
        .refine((arr) => (arr ? arr.length <= 50 : true), {
            message: 'Too many ids (max 50 allowed)',
        })
        .refine(
            (arr) => (arr ? arr.every((id) => /^[0-9a-fA-F-]{36}$/.test(id)) : true),
            { message: 'All ids must be UUIDs' },
        ),
    language: languageParamSchema,
    limit: limitParamSchema,
});

export type GetArticlesHttpParams = z.infer<typeof getArticlesParamsSchema>;

/**
 * Handles HTTP request validation and transformation for GET /articles endpoint
 * Transforms raw HTTP input to validated domain objects
 */
export class GetArticlesRequestHandler {
    /**
     * Validates and transforms raw HTTP query parameters to domain objects
     *
     * @param rawQuery - Raw HTTP query parameters
     * @returns Validated and transformed parameters
     * @throws HTTPException with 422 status for validation errors
     */
    handle(rawQuery: GetArticlesHttpQuery): GetArticlesHttpParams {
        const validatedParams = getArticlesParamsSchema.safeParse(rawQuery);

        if (!validatedParams.success) {
            throw new HTTPException(422, {
                cause: { details: validatedParams.error.issues },
                message: 'Invalid request parameters',
            });
        }

        const data = validatedParams.data as unknown as Record<string, unknown>;
        // Normalise: treat empty ids array as absent
        if (Array.isArray((data as { ids?: unknown }).ids) && (data.ids as unknown[]).length === 0) {
            delete (data as { ids?: unknown }).ids;
        }
        return data as GetArticlesHttpParams;
    }
}
