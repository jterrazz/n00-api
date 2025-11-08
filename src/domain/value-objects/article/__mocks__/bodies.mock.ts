import { Body } from '../body.vo.js';

const BODY_TEXTS: string[] = [
    'The government announced a new policy today aimed at improving economic growth across the region.',
    'Scientists have discovered a potential breakthrough in renewable energy technology that could change the industry.',
    'Health officials are warning of an uptick in seasonal illnesses and advising precautions.',
    'A landmark court ruling has set a new precedent for data privacy rights globally.',
];

export const BODY_FIXTURES: Body[] = BODY_TEXTS.map((t) => new Body(t));

export function getBody(index = 0): Body {
    return BODY_FIXTURES[index % BODY_FIXTURES.length];
}
