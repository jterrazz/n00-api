import { ReportAngle } from '../report-angle.vo.js';

import { getAngleNarrative } from './angle-narrative.mock.js';

/**
 * Generates a single mock `ReportAngle` instance.
 */
export function createMockReportAngle(index: number): ReportAngle {
    return new ReportAngle({
        narrative: getAngleNarrative(index),
    });
}

/**
 * Generates an array of mock `ReportAngle` instances.
 */
export function mockReportAngles(count: number): ReportAngle[] {
    return Array.from({ length: count }, (_, index) => createMockReportAngle(index));
}
