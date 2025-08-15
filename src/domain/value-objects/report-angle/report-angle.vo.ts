import { z } from 'zod/v4';

import { AngleNarrative } from './angle-narrative.vo.js';

export const reportAngleSchema = z.object({
    narrative: z.instanceof(AngleNarrative),
});

export type ReportAngleData = z.input<typeof reportAngleSchema>;

/**
 * @description A value object representing a unique viewpoint on a report.
 * It contains the complete narrative of that perspective.
 * It purposefully has **no identity of its own** – two angles
 * with the same narrative are considered equal.
 */
export class ReportAngle {
    public readonly narrative: AngleNarrative;

    constructor(data: ReportAngleData) {
        const result = reportAngleSchema.safeParse(data);

        if (!result.success) {
            throw new Error(`Invalid report angle data: ${result.error.message}`);
        }

        const validated = result.data;
        this.narrative = validated.narrative;
    }
}
