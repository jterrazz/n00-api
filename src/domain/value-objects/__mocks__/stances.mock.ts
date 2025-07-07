import { Stance } from '../stance.vo.js';

const STANCE_VALUES: Stance['value'][] = [
    'supportive',
    'critical',
    'neutral',
    'mixed',
    'concerned',
    'optimistic',
    'skeptical',
];

export const STANCE_FIXTURES: Stance[] = STANCE_VALUES.map((s) => new Stance(s));

export function getStance(index = 0): Stance {
    return STANCE_FIXTURES[index % STANCE_FIXTURES.length];
}

export function randomStance(): Stance {
    return STANCE_FIXTURES[Math.floor(Math.random() * STANCE_FIXTURES.length)];
}
