import { AngleCorpus } from '../angle-corpus.vo.js';

/**
 * Returns a mock `AngleCorpus` instance for the given index.
 * The generated text is long enough to satisfy the minimum length validation
 * (200 characters) enforced by the `AngleCorpus` value object.
 */
export function getAngleCorpus(index = 0): AngleCorpus {
    return new AngleCorpus(
        `Mock angle corpus ${index}. This is a comprehensive summary of a specific viewpoint on the report. It contains all the key arguments, evidence, quotes, and contextual details necessary to construct a full article from this angle. The information is presented in a raw, exhaustive format that provides complete coverage of this particular angle on the events and issues discussed in the main report.`,
    );
}

/**
 * Generates an array of mock `AngleCorpus` instances.
 */
export function mockAngleCorpora(count: number): AngleCorpus[] {
    return Array.from({ length: count }, (_, idx) => getAngleCorpus(idx));
}
