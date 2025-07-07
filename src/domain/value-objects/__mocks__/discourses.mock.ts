import { Discourse } from '../discourse.vo.js';

const DISCOURSE_VALUES: Discourse['value'][] = [
    'mainstream',
    'alternative',
    'underreported',
    'dubious',
];

export const DISCOURSE_FIXTURES: Discourse[] = DISCOURSE_VALUES.map((d) => new Discourse(d));

/**
 * Cycles through the discourse fixtures deterministically.
 */
export function getDiscourse(index = 0): Discourse {
    return DISCOURSE_FIXTURES[index % DISCOURSE_FIXTURES.length];
}

/**
 * Returns a random discourse fixture.
 */
export function randomDiscourse(): Discourse {
    return DISCOURSE_FIXTURES[Math.floor(Math.random() * DISCOURSE_FIXTURES.length)];
}
