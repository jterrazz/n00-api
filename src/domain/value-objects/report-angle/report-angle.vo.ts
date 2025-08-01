import { z } from 'zod/v4';

import { Stance } from '../stance.vo.js';

import { AngleCorpus } from './angle-corpus.vo.js';

export const reportAngleSchema = z.object({
    angleCorpus: z.instanceof(AngleCorpus),
    stance: z.instanceof(Stance),
});

export type ReportAngleData = z.input<typeof reportAngleSchema>;

/**
 * @description A value object representing a unique viewpoint on a report.
 * It contains the complete digest of that viewpoint plus its descriptive tags.
 * It purposefully has **no identity of its own** – two angles
 * with the same digest & tags are considered equal.
 */
export class ReportAngle {
    public readonly angleCorpus: AngleCorpus;
    public readonly stance: Stance;

    constructor(data: ReportAngleData) {
        const result = reportAngleSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid report angle data: ${result.error.message}`);
        }

        const validated = result.data;
        this.angleCorpus = validated.angleCorpus;
        this.stance = validated.stance;
    }
}
