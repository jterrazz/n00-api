import { z } from 'zod/v4';

import { PerspectiveCorpus } from './perspective-corpus.vo.js';
import { discourseTypeSchema, stanceSchema } from './perspective-tags.vo.js';

export const storyPerspectiveSchema = z.object({
    discourse: discourseTypeSchema,
    perspectiveCorpus: z.instanceof(PerspectiveCorpus),
    stance: stanceSchema,
});

export type StoryPerspectiveData = z.input<typeof storyPerspectiveSchema>;

/**
 * @description A value object representing a unique viewpoint on a story.
 * It contains the complete digest of that viewpoint plus its descriptive tags.
 * It purposefully has **no identity of its own** – two perspectives
 * with the same digest & tags are considered equal.
 */
export class StoryPerspective {
    public readonly discourse: z.infer<typeof discourseTypeSchema>;
    public readonly perspectiveCorpus: PerspectiveCorpus;
    public readonly stance: z.infer<typeof stanceSchema>;

    constructor(data: StoryPerspectiveData) {
        const result = storyPerspectiveSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid story perspective data: ${result.error.message}`);
        }

        const validated = result.data;
        this.perspectiveCorpus = validated.perspectiveCorpus;
        this.stance = validated.stance;
        this.discourse = validated.discourse;
    }
}
