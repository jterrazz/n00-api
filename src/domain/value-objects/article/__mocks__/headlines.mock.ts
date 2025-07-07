import { Headline } from '../headline.vo.js';

const HEADLINE_TEXTS: string[] = [
    'Government Unveils New Economic Policy',
    'Breakthrough in Renewable Energy Discovered',
    'Health Officials Issue Seasonal Warning',
    'Court Ruling Changes Data Privacy Landscape',
];

export const HEADLINE_FIXTURES: Headline[] = HEADLINE_TEXTS.map((h) => new Headline(h));

export function getHeadline(index = 0): Headline {
    return HEADLINE_FIXTURES[index % HEADLINE_FIXTURES.length];
}

export function randomHeadline(): Headline {
    return HEADLINE_FIXTURES[Math.floor(Math.random() * HEADLINE_FIXTURES.length)];
}
