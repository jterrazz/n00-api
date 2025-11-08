import { z } from 'zod/v4';

export const countrySchema = z
    .enum(['FR', 'US'])
    .describe(
        'Identifies the target countries where the report is relevant and should be surfaced. Use the two-letter ISO code in uppercase for specific countries.',
    );

export type CountryEnum = z.infer<typeof countrySchema>;

export class Country {
    public readonly value: CountryEnum;

    constructor(country: string) {
        const normalizedCountry = country.toUpperCase();
        const result = countrySchema.safeParse(normalizedCountry);

        if (!result.success) {
            throw new Error(
                `Invalid country: ${country}. Supported countries are: ${countrySchema.options.join(', ')}`,
            );
        }

        this.value = result.data;
    }

    public isGlobal(): boolean {
        return false;
    }

    public toString(): CountryEnum {
        return this.value;
    }
}
