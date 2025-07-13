import { z } from 'zod/v4';

/**
 * Enumerates the possible authenticity states of an article.
 */

export enum AuthenticityStatusEnum {
    AUTHENTIC = 'AUTHENTIC',
    FABRICATED = 'FABRICATED',
}

export const authenticityStatusSchema = z.nativeEnum(AuthenticityStatusEnum);

export const authenticitySchema = z
    .object({
        clarification: z.string().nullable().default(null),
        status: authenticityStatusSchema.default(AuthenticityStatusEnum.AUTHENTIC),
    })
    .refine((data) => data.status !== AuthenticityStatusEnum.FABRICATED || !!data.clarification, {
        message: 'Fabricated articles must include a clarification',
        path: ['clarification'],
    });

export class Authenticity {
    public readonly clarification: null | string;
    public readonly status: AuthenticityStatusEnum;

    constructor(status: AuthenticityStatusEnum, clarification: null | string = null) {
        const result = authenticitySchema.safeParse({ clarification, status });

        if (!result.success) {
            throw new Error(`Invalid authenticity: ${result.error.message}`);
        }

        this.status = result.data.status;
        this.clarification = result.data.clarification;
    }

    /** Convenience: true when status === FABRICATED */
    public isFabricated(): boolean {
        return this.status === AuthenticityStatusEnum.FABRICATED;
    }

    public toString(): string {
        return this.isFabricated()
            ? `Fabricated article (Clarification: ${this.clarification})`
            : 'Authentic article';
    }
}
