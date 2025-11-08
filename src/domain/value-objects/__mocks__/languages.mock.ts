import { Language } from '../language.vo.js';

const LANGUAGE_VALUES: Language['value'][] = ['EN', 'FR'];

export const LANGUAGE_FIXTURES: Language[] = LANGUAGE_VALUES.map((l) => new Language(l));

export function getLanguage(index = 0): Language {
    return LANGUAGE_FIXTURES[index % LANGUAGE_FIXTURES.length];
}
