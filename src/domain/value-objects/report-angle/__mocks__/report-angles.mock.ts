import { getStance } from '../../__mocks__/stances.mock.js';
import { ReportAngle } from '../report-angle.vo.js';

import { getAngleCorpus } from './angle-corpus.mock.js';

/**
 * Generates a single mock `ReportAngle` instance.
 */
export function createMockReportAngle(index: number): ReportAngle {
    return new ReportAngle({
        angleCorpus: getAngleCorpus(index),
        stance: getStance(index),
    });
}

/**
 * Generates an array of mock `ReportAngle` instances.
 */
export function mockReportAngles(count: number): ReportAngle[] {
    return Array.from({ length: count }, (_, index) => createMockReportAngle(index));
}
