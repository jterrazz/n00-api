import { Classification } from '../tier.vo.js';

const CLASS_VALUES: Classification['value'][] = ['GENERAL', 'NICHE', 'OFF_TOPIC'];

export const CLASSIFICATION_FIXTURES: Classification[] = CLASS_VALUES.map(
    (v) => new Classification(v),
);

export function getClassification(index = 0): Classification {
    return CLASSIFICATION_FIXTURES[index % CLASSIFICATION_FIXTURES.length];
}
