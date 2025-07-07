import { Country } from '../country.vo.js';

const COUNTRY_VALUES: Country['value'][] = ['us', 'fr', 'global'];

export const COUNTRY_FIXTURES: Country[] = COUNTRY_VALUES.map((c) => new Country(c));

export function getCountry(index = 0): Country {
    return COUNTRY_FIXTURES[index % COUNTRY_FIXTURES.length];
}

export function randomCountry(): Country {
    return COUNTRY_FIXTURES[Math.floor(Math.random() * COUNTRY_FIXTURES.length)];
}
