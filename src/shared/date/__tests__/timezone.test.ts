import { TZDate } from '@date-fns/tz';
import { afterEach, beforeEach, describe, expect, it, mockOfDate } from '@jterrazz/test';

import {
    COUNTRY_TIMEZONE_MAP,
    createCurrentTZDateForCountry,
    createTZDateForCountry,
    formatTZDateForCountry,
    subtractDays,
} from '../timezone.js';

describe('Timezone Utilities', () => {
    const originalDate = new Date('2024-01-01T12:30:45.123Z');
    const parisTimezone = 'Europe/Paris';

    beforeEach(() => {
        mockOfDate.set(originalDate);
    });

    afterEach(() => {
        mockOfDate.reset();
    });

    describe('createCurrentTZDateForCountry', () => {
        it.each([
            { country: 'FR', expectedHour: 13 }, // UTC+1 for Paris
            { country: 'US', expectedHour: 7 }, // UTC-5 for New York
        ])('should return correct hour for $country', ({ country, expectedHour }) => {
            // Given - a country code and a fixed original date
            // When - creating a TZDate for the country using createCurrentTZDateForCountry
            const tzDate = createCurrentTZDateForCountry(country);

            // Then - it should return the correct hour and timezone for the country
            expect(tzDate.getHours()).toBe(expectedHour);
            expect(tzDate).toBeInstanceOf(TZDate);
            expect(tzDate.timeZone).toBe(COUNTRY_TIMEZONE_MAP[country.toLowerCase()]);
            expect(tzDate.getTime()).toBe(originalDate.getTime());
        });

        it('should throw error for unsupported country', () => {
            // Given - an unsupported country code for createCurrentTZDateForCountry
            // When - calling createCurrentTZDateForCountry with the unsupported country
            // Then - it should throw an error indicating the country is not supported
            expect(() => createCurrentTZDateForCountry('invalid')).toThrow(
                'Unsupported country: invalid. Supported countries are: ar, at, au, be, br, ca, ch, cl, cn, co, cz, de, dk, eg, es, fi, fr, gb, gr, hk, hu, id, ie, in, it, jp, ke, kr, ma, mx, my, ng, nl, no, nz, pe, ph, pl, pt, ro, ru, se, sg, th, tw, us, uy, vn, za',
            );
        });

        it('should handle uppercase country codes', () => {
            // Given - a country code in uppercase and a fixed original date
            // When - calling createCurrentTZDateForCountry with the uppercase code
            const tzDate = createCurrentTZDateForCountry('FR');

            // Then - it should return the correct hour and timezone for the country
            expect(tzDate.getHours()).toBe(13); // UTC+1 for Paris
            expect(tzDate.timeZone).toBe(parisTimezone);
        });
    });

    describe('createTZDateForCountry', () => {
        it.each([
            { country: 'FR', timezone: 'Europe/Paris' },
            { country: 'US', timezone: 'America/New_York' },
        ])('should create TZDate with correct timezone for $country', ({ country, timezone }) => {
            // Given - a date and a country code
            const date = new Date('2024-01-01T12:30:00Z');

            // When - creating a TZDate for the country using createTZDateForCountry
            const tzDate = createTZDateForCountry(date, country);

            // Then - it should return a TZDate with the correct timezone and time
            expect(tzDate).toBeInstanceOf(TZDate);
            expect(tzDate.timeZone).toBe(timezone);
            expect(tzDate.getTime()).toBe(date.getTime());
        });

        it('should handle Date objects and timestamps', () => {
            // Given - a Date object and a timestamp representing the same moment
            const date = new Date('2024-01-01T12:30:00Z');
            const timestamp = date.getTime();

            // When - creating TZDate for both inputs using createTZDateForCountry
            const tzDateFromDate = createTZDateForCountry(date, 'FR');
            const tzDateFromTimestamp = createTZDateForCountry(timestamp, 'FR');

            // Then - it should return TZDates with the same time and timezone
            expect(tzDateFromDate.getTime()).toBe(tzDateFromTimestamp.getTime());
            expect(tzDateFromDate.timeZone).toBe(tzDateFromTimestamp.timeZone);
        });

        it('should throw error for unsupported country', () => {
            // Given - an unsupported country code for the function
            // When - calling the function with the unsupported country
            // Then - it should throw an error indicating the country is not supported
            expect(() => createTZDateForCountry(new Date(), 'invalid')).toThrow(
                'Unsupported country: invalid. Supported countries are: ar, at, au, be, br, ca, ch, cl, cn, co, cz, de, dk, eg, es, fi, fr, gb, gr, hk, hu, id, ie, in, it, jp, ke, kr, ma, mx, my, ng, nl, no, nz, pe, ph, pl, pt, ro, ru, se, sg, th, tw, us, uy, vn, za',
            );
        });
    });

    describe('formatTZDateInCountry', () => {
        it.each([
            { expected: '06:30', fromCountry: 'FR', toCountry: 'US' }, // Paris -> New York (UTC+1 -> UTC-5)
            { expected: '18:30', fromCountry: 'US', toCountry: 'FR' }, // New York -> Paris (UTC-5 -> UTC+1)
            { expected: '12:30', fromCountry: 'FR', toCountry: 'FR' }, // Paris -> Paris (no change)
        ])(
            'should format time from $fromCountry timezone to $toCountry timezone',
            ({ expected, fromCountry, toCountry }) => {
                // Given - a TZDate in the fromCountry's timezone
                const tzDate = new TZDate(
                    2024,
                    0,
                    1,
                    12,
                    30,
                    0,
                    0,
                    COUNTRY_TIMEZONE_MAP[fromCountry.toLowerCase()],
                );

                // When - formatting the TZDate to the toCountry's timezone using formatTZDateInCountry
                const formatted = formatTZDateForCountry(tzDate, toCountry, 'HH:mm');

                // Then - it should return the expected formatted time string
                expect(formatted).toBe(expected);
            },
        );

        it('should handle uppercase country codes', () => {
            // Given - a TZDate in Paris timezone and an uppercase country code
            const tzDate = new TZDate(2024, 0, 1, 12, 30, 0, 0, parisTimezone);

            // When - formatting the TZDate using formatTZDateInCountry with uppercase code
            const formatted = formatTZDateForCountry(tzDate, 'FR', 'HH:mm');

            // Then - it should return the correct formatted time string
            expect(formatted).toBe('12:30');
        });

        it('should throw error for unsupported country', () => {
            // Given - an unsupported country code
            // When - calling the function
            // Then - it should throw an error
            expect(() =>
                formatTZDateForCountry(
                    new TZDate(2024, 0, 1, 12, 30, 0, 0, parisTimezone),
                    'invalid',
                    'HH:mm',
                ),
            ).toThrow(
                'Unsupported country: invalid. Supported countries are: ar, at, au, be, br, ca, ch, cl, cn, co, cz, de, dk, eg, es, fi, fr, gb, gr, hk, hu, id, ie, in, it, jp, ke, kr, ma, mx, my, ng, nl, no, nz, pe, ph, pl, pt, ro, ru, se, sg, th, tw, us, uy, vn, za',
            );
        });
    });

    describe('subtractDays', () => {
        it('should subtract days while preserving timezone', () => {
            // Given - a TZDate in Paris timezone
            const date = new TZDate(2024, 0, 15, 12, 0, 0, 0, parisTimezone);

            // When - subtracting days using subtractDays
            const result = subtractDays(date, 5);

            // Then - it should return a TZDate with the same timezone and the correct date
            expect(result).toBeInstanceOf(TZDate);
            expect(result.timeZone).toBe(parisTimezone);
            expect(result.getDate()).toBe(10);
        });

        it('should handle month/year boundaries', () => {
            // Given - a TZDate at the start of the year in Paris timezone
            const date = new TZDate(2024, 0, 1, 12, 0, 0, 0, parisTimezone);

            // When - subtracting days using subtractDays
            const result = subtractDays(date, 2);

            // Then - it should return a TZDate with the correct year, month, and date
            expect(result.getFullYear()).toBe(2023);
            expect(result.getMonth()).toBe(11); // December
            expect(result.getDate()).toBe(30);
        });

        it('should preserve time components', () => {
            // Given - a TZDate with specific time components in Paris timezone
            const date = new TZDate(2024, 0, 15, 14, 30, 45, 123, parisTimezone);

            // When - subtracting days using subtractDays
            const result = subtractDays(date, 5);

            // Then - it should preserve the hour, minute, second, and millisecond components
            expect(result.getHours()).toBe(14); // UTC+1 for Paris
            expect(result.getMinutes()).toBe(30);
            expect(result.getSeconds()).toBe(45);
            expect(result.getMilliseconds()).toBe(123);
        });
    });
});
