import { z } from 'zod/v4';

import { Body } from '../article/body.vo.js';
import { Headline } from '../article/headline.vo.js';

export const articleFrameSchema = z.object({
    body: z.instanceof(Body),
    headline: z.instanceof(Headline),
});

export type ArticleFrameData = z.input<typeof articleFrameSchema>;

/**
 * @description Represents a specific frame of an article
 */
export class ArticleFrame {
    public readonly body: Body;
    public readonly headline: Headline;

    constructor(data: ArticleFrameData) {
        const result = articleFrameSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid article frame data: ${result.error.message}`);
        }

        const validatedData = result.data;
        this.headline = validatedData.headline;
        this.body = validatedData.body;
    }
}
