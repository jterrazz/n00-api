import { z } from 'zod/v4';

import { PerspectiveCorpus } from './perspective-corpus.vo.js';
import { PerspectiveTags } from './perspective-tags.vo.js';

export const storyPerspectiveSchema = z.object({
    perspectiveCorpus: z.instanceof(PerspectiveCorpus),
    tags: z.instanceof(PerspectiveTags),
});

export type StoryPerspectiveData = z.input<typeof storyPerspectiveSchema>;

/**
 * @description A value object representing a unique viewpoint on a story.
 * It contains the complete digest of that viewpoint plus its descriptive tags.
 * It purposefully has **no identity of its own** – two perspectives
 * with the same digest & tags are considered equal.
 */
export class StoryPerspective {
    public readonly perspectiveCorpus: PerspectiveCorpus;
    public readonly tags: PerspectiveTags;

    constructor(data: StoryPerspectiveData) {
        const result = storyPerspectiveSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid story perspective data: ${result.error.message}`);
        }

        const validated = result.data;
        this.perspectiveCorpus = validated.perspectiveCorpus;
        this.tags = validated.tags;
    }
}
