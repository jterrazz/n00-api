import { type Report } from '../../../../domain/entities/report.entity.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

/**
 * @description
 * Port for the Article Composition Agent that generates articles from structured report data
 */
export interface ArticleCompositionAgentPort {
    run(input: ArticleCompositionInput): Promise<ArticleCompositionResult | null>;
}

/**
 * @description
 * Input data required for article composition
 */
export interface ArticleCompositionInput {
    report: Report;
    targetCountry: Country;
    targetLanguage: Language;
}

/**
 * @description
 * Result of article composition containing the main article and angle frames
 */
export interface ArticleCompositionResult {
    body: string;
    frames: Array<{
        body: string;
        headline: string;
        stance: string;
    }>;
    headline: string;
}
