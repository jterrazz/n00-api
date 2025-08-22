import { z } from 'zod/v4';

export const articleTraitsSchema = z.object({
    essential: z
        .boolean()
        .default(false)
        .describe('Content that improves understanding and intellectual growth'),
    positive: z
        .boolean()
        .default(false)
        .describe('Content showcasing genuine progress and constructive developments'),
});

export type ArticleTraitsProps = z.infer<typeof articleTraitsSchema>;

export class ArticleTraits {
    public readonly essential: boolean;
    public readonly positive: boolean;

    constructor(data: Partial<ArticleTraitsProps> = {}) {
        const validatedData = articleTraitsSchema.parse(data);
        this.essential = validatedData.essential;
        this.positive = validatedData.positive;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static fromJSON(json: any): ArticleTraits {
        if (!json || typeof json !== 'object') {
            return new ArticleTraits();
        }

        return new ArticleTraits({
            essential: Boolean(json.essential),
            positive: Boolean(json.positive),
        });
    }

    public hasAnyTrait(): boolean {
        return this.essential || this.positive;
    }

    public toJSON(): ArticleTraitsProps {
        return {
            essential: this.essential,
            positive: this.positive,
        };
    }
}
