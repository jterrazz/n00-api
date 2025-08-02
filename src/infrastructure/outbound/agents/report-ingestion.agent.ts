import {
    BasicAgentAdapter,
    type ModelPort,
    PROMPT_LIBRARY,
    SystemPromptAdapter,
    UserPromptAdapter,
} from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

import {
    type ReportIngestionAgentPort,
    type ReportIngestionResult,
} from '../../../application/ports/outbound/agents/report-ingestion.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

import { factsSchema } from '../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../domain/value-objects/article-traits.vo.js';
import { Categories, categoriesSchema } from '../../../domain/value-objects/categories.vo.js';
import { angleCorpusSchema } from '../../../domain/value-objects/report-angle/angle-corpus.vo.js';
import { stanceSchema } from '../../../domain/value-objects/stance.vo.js';

export class ReportIngestionAgentAdapter implements ReportIngestionAgentPort {
    static readonly SCHEMA = z.object({
        angles: z
            .array(
                z.object({
                    corpus: angleCorpusSchema.describe(
                        'A complete compilation of all information for this viewpoint, NOT a summary. It must be focused on the news event itself and include every argument, fact, and piece of evidence presented for this side. It MUST NOT contain information about the news source.',
                    ),
                    stance: stanceSchema,
                }),
            )
            .max(3, 'No more than three angles should be created.'),
        categories: categoriesSchema,
        facts: factsSchema,
        traits: z.object({
            smart: z
                .boolean()
                .default(false)
                .describe('Content that improves understanding and intellectual growth'),
            uplifting: z
                .boolean()
                .default(false)
                .describe('Content that promotes positive emotions and hope'),
        }),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are a senior investigative journalist and media analyst for a global newsroom. Your mission is to distil multiple news articles about the same event into a structured intelligence brief that surfaces the undisputed facts and the genuinely distinct viewpoints at play.',
        'Your analysis must remain strictly grounded in the provided text—no external knowledge or opinions. Identify and categorise only those viewpoints that are truly different or opposing, ignoring superficial wording variations, so that readers can quickly grasp the real landscape of the public debate.',
        'CRITICAL: Output MUST be in English.',
        PROMPT_LIBRARY.LANGUAGES.ENGLISH_NATIVE,
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.TONES.NEUTRAL,
        PROMPT_LIBRARY.VERBOSITY.DETAILED,
    );

    public readonly name = 'ReportIngestionAgent';

    private readonly agent: BasicAgentAdapter<z.infer<typeof ReportIngestionAgentAdapter.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ReportIngestionAgentAdapter.SCHEMA,
            systemPrompt: ReportIngestionAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (newsReport: NewsReport) =>
        new UserPromptAdapter(
            // Core Mission
            'Your mission is to transform the following news articles, all covering the SAME subject, into a structured intelligence brief composed of VERIFIED FACTS and up to TWO genuinely DISTINCT ANGLES (viewpoints).',
            '',

            // Output Requirements
            'OUTPUT REQUIREMENTS:',
            '• facts → A neutral, exhaustive statement of who did what, where, and when. No speculation, opinion, or editorialising.',
            '• categories → An array of at least one topic category: POLITICS, BUSINESS, TECHNOLOGY, SCIENCE, HEALTH, ENVIRONMENT, SOCIETY, ENTERTAINMENT, SPORTS, OTHER',
            '• traits → Content characteristics (boolean flags):',
            '    • smart → true if content improves understanding and intellectual growth (avoid superficial/clickbait)',
            '    • uplifting → true if content promotes positive emotions and hope (not just "less bad" news)',
            '• angles → An array with **1-2** items. For each angle include:',
            '    • corpus → NOT a summary. Compile EVERY argument, fact, and piece of evidence supporting that viewpoint, focused solely on the subject. Exclude information about the publication or author.',
            '    • stance → A metadata about the tone (e.g. SUPPORTIVE, CRITICAL, NEUTRAL).',
            '',

            // Analysis Framework
            'ANALYSIS FRAMEWORK:',
            '1. Extract the undisputed facts common to all.',
            '2. Identify every viewpoint expressed across articles and MERGE any that share the same core argument.',
            '3. Select the 0-3 most dominant, clearly DIFFERENT angles.',
            '4. For each selected angle, compile the full corpus',
            '5. Assign the `stance` tag.',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '• Focus ONLY on the news subject; do NOT create angles about the publication or journalists.',
            '• Use ONLY the provided text—no external information.',
            '• Never produce more than 2 angles; merge redundant ones.',
            '• ALWAYS include at least one topic category in the categories array.',
            '• Trait flags are boolean - set to true only when content genuinely meets the criteria.',
            '• smart flag should only be true for intellectually enriching content that helps understanding.',
            '• uplifting flag should only be true for authentically positive content, not neutral or "less negative" stories.',
            '• Traits are separate from categories - keep topic classification distinct from content characteristics.',
            '',

            // Data input
            'NEWS ARTICLES TO ANALYSE:',
            JSON.stringify(
                newsReport.articles.map((article) => ({
                    body: article.body,
                    headline: article.headline,
                })),
                null,
                2,
            ),
        );

    async run(params: { newsReport: NewsReport }): Promise<null | ReportIngestionResult> {
        try {
            this.logger.info(`Ingesting report with ${params.newsReport.articles.length} articles`);

            const result = await this.agent.run(
                ReportIngestionAgentAdapter.USER_PROMPT(params.newsReport),
            );

            if (!result) {
                this.logger.warn('Ingestion agent returned no result');
                return null;
            }

            // Log successful parsing for debugging
            this.logger.info(
                `AI response parsed successfully with ${result.angles.length} angles`,
                {
                    categories: result.categories,
                    stances: result.angles.map((angle) => angle.stance),
                    traits: result.traits,
                },
            );

            // Create value objects from AI response
            const categories = new Categories(result.categories);
            const traits = new ArticleTraits(result.traits);

            // Create angle data from AI response (without creating full ReportAngle entities)
            const angles = result.angles.map((angleData) => ({
                corpus: angleData.corpus,
                stance: angleData.stance,
            }));

            const ingestionResult: ReportIngestionResult = {
                angles,
                categories,
                facts: result.facts,
                traits,
            };

            this.logger.info(
                `Report ingested: ${ingestionResult.facts.substring(0, 100)}... with ${ingestionResult.angles.length} angles`,
            );

            return ingestionResult;
        } catch (error) {
            this.logger.error('Failed to ingest report', {
                articleCount: params.newsReport.articles.length,
                error,
            });
            return null;
        }
    }
}
