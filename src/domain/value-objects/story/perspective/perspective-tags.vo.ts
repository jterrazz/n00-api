import { z } from 'zod/v4';

export const stanceSchema = z.enum([
    'supportive',
    'critical',
    'neutral',
    'mixed',
    'concerned',
    'optimistic',
    'skeptical',
]).describe(`The perspective's stance toward the specific story:
- supportive: supports what's happening
- critical: critical of what's happening  
- neutral: balanced/no clear position
- mixed: both positive and negative aspects
- concerned: worried about implications
- optimistic: hopeful about outcomes
- skeptical: doubtful/questioning`);

export const discourseTypeSchema = z.enum(['mainstream', 'alternative', 'underreported', 'dubious'])
    .describe(`Where this perspective sits in public discourse:
- mainstream: main viewpoint of consensual medias
- alternative: opposite side to mainstream medias viewpoint, but still in the public traditional medias and debate
- underreported: non visible stories in the classical medias, only found in external places outside traditional medias coverage
- dubious: questionable claims, of doubtful validity`);

export const perspectiveTagsSchema = z
    .object({
        discourse_type: discourseTypeSchema.optional(),
        stance: stanceSchema.optional(),
    })
    .refine((tags) => Object.values(tags).some((value) => value !== undefined), {
        message: 'At least one tag must be provided',
    })
    .describe("Tags that categorize a perspective's stance and position in public discourse");

export type DiscourseType = z.infer<typeof discourseTypeSchema>;
export type PerspectiveTagsData = z.infer<typeof perspectiveTagsSchema>;
export type Stance = z.infer<typeof stanceSchema>;

export class PerspectiveTags {
    public readonly tags: PerspectiveTagsData;

    constructor(tags: PerspectiveTagsData) {
        const result = perspectiveTagsSchema.safeParse(tags);

        if (!result.success) {
            throw new Error(`Invalid perspective tags: ${result.error.message}`);
        }

        this.tags = result.data;
    }

    public toString(): string {
        return JSON.stringify(this.tags);
    }
}
