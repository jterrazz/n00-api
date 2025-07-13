/**
 * Utility to normalise dynamic fields (UUIDs, timestamps, provider sources, etc.)
 * so that snapshot comparisons remain stable between runs.
 *
 * @example
 *   const snapshot = normaliseSnapshot(response);
 *   const snapshotWithExtra = normaliseSnapshot(response, [[/^foo/, '<foo>']]);
 */

const UUID_RE = /^[0-9a-f-]{36}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

export type ReplacementRule = [pattern: RegExp, placeholder: string];

/**
 * Recursively walks through an object/array/string tree and replaces dynamic values
 * (UUIDs, ISO dates, plus any caller-specified patterns) with static placeholders.
 *
 * @param value         The value to normalise (object, array, primitive).
 * @param extraRules    Additional `[RegExp, placeholder]` pairs applied after built-in rules.
 * @returns             A deeply-cloned, normalised value suitable for snapshot testing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseSnapshot(value: any, extraRules: ReplacementRule[] = []): any {
    if (Array.isArray(value)) {
        return value.map((v) => normaliseSnapshot(v, extraRules));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, normaliseSnapshot(v, extraRules)]),
        );
    }

    if (typeof value === 'string') {
        if (UUID_RE.test(value)) return '<uuid>';
        if (ISO_RE.test(value)) return '<date>';

        for (const [pattern, placeholder] of extraRules) {
            if (pattern.test(value)) return placeholder;
        }
    }

    return value;
} 