import { z } from 'zod/v4';

export const articleTraitsSchema = z.object({
    smart: z
        .boolean()
        .default(false)
        .describe('Content that improves understanding and intellectual growth'),
    uplifting: z
        .boolean()
        .default(false)
        .describe('Content that promotes positive emotions and hope'),
});

export type ArticleTraitsProps = z.infer<typeof articleTraitsSchema>;

export class ArticleTraits {
    public readonly smart: boolean;
    public readonly uplifting: boolean;

    constructor(data: Partial<ArticleTraitsProps> = {}) {
        const validatedData = articleTraitsSchema.parse(data);
        this.smart = validatedData.smart;
        this.uplifting = validatedData.uplifting;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static fromJSON(json: any): ArticleTraits {
        if (!json || typeof json !== 'object') {
            return new ArticleTraits();
        }

        return new ArticleTraits({
            smart: Boolean(json.smart),
            uplifting: Boolean(json.uplifting),
        });
    }

    public hasAnyTrait(): boolean {
        return this.smart || this.uplifting;
    }

    public toJSON(): ArticleTraitsProps {
        return {
            smart: this.smart,
            uplifting: this.uplifting,
        };
    }
}
