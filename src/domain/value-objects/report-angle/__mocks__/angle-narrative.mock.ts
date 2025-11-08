import { AngleNarrative } from '../angle-narrative.vo.js';

/**
 * Returns a mock `AngleNarrative` instance for the given index.
 * The generated text is long enough to satisfy the minimum length validation
 * (200 characters) enforced by the `AngleNarrative` value object.
 */
export function getAngleNarrative(index = 0): AngleNarrative {
    return new AngleNarrative(
        `Mock angle narrative ${index}. This is a comprehensive narrative presenting a specific perspective on the story. It contains all the key arguments, evidence, quotes, and contextual details necessary to understand this viewpoint completely. The narrative is presented as a thorough account that provides complete coverage of this particular perspective on the events and issues discussed in the main report.`,
    );
}

/**
 * Generates an array of mock `AngleNarrative` instances.
 */
export function mockAngleNarratives(count: number): AngleNarrative[] {
    return Array.from({ length: count }, (_, idx) => getAngleNarrative(idx));
}
