import { Classification } from '../classification.vo.js';

const CLASS_VALUES: Classification['value'][] = [
    'STANDARD',
    'NICHE',
    'PENDING_CLASSIFICATION',
    'ARCHIVED',
];

export const CLASSIFICATION_FIXTURES: Classification[] = CLASS_VALUES.map(
    (v) => new Classification(v),
);

export function getClassification(index = 0): Classification {
    return CLASSIFICATION_FIXTURES[index % CLASSIFICATION_FIXTURES.length];
}

export function randomClassification(): Classification {
    return CLASSIFICATION_FIXTURES[Math.floor(Math.random() * CLASSIFICATION_FIXTURES.length)];
}
