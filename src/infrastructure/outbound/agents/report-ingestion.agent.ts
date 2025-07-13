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
import { Category } from '../../../domain/value-objects/category.vo.js';
import { categorySchema } from '../../../domain/value-objects/category.vo.js';
import { discourseSchema } from '../../../domain/value-objects/discourse.vo.js';
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
                    discourse: discourseSchema,
                    stance: stanceSchema,
                }),
            )
            .min(1, 'At least one angle is required.')
            .max(2, 'No more than two angles should be created.'),
        category: categorySchema,
        facts: factsSchema,
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
            '• angles → An array with **1-2** items. For each angle include:',
            '    • corpus → NOT a summary. Compile EVERY argument, fact, and piece of evidence supporting that viewpoint, focused solely on the subject. Exclude information about the publication or author.',
            '    • tags → { stance, discourse_type } where `stance` reflects tone (e.g. SUPPORTIVE, CRITICAL) and `discourse_type` is MAINSTREAM or ALTERNATIVE.',
            '',

            // Analysis Framework
            'ANALYSIS FRAMEWORK:',
            '1. Extract the undisputed facts common to all.',
            '2. Identify every viewpoint expressed across articles and MERGE any that share the same core argument.',
            '3. Select the 1-2 most dominant, clearly DIFFERENT angles.',
            '4. For each selected angle, compile the full corpus and assign `stance` and `discourse_type` tags.',
            '',

            // Discourse Definitions
            'DISCOURSE DEFINITIONS:',
            '• MAINSTREAM → Dominant media narrative (widely amplified).',
            '• ALTERNATIVE → Counter-narratives that challenges or contradicts the mainstream.',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '• Focus ONLY on the news subject; do NOT create angles about the publication or journalists.',
            '• Use ONLY the provided text—no external information.',
            '• Never produce more than 2 angles; merge redundant ones.',
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
            this.logger.info(
                `[${this.name}] Ingesting report with ${params.newsReport.articles.length} articles`,
            );

            const result = await this.agent.run(
                ReportIngestionAgentAdapter.USER_PROMPT(params.newsReport),
            );

            if (!result) {
                this.logger.warn(`[${this.name}] No result from AI model`);
                return null;
            }

            // Log successful parsing for debugging
            this.logger.info(
                `[${this.name}] Successfully parsed AI response with ${result.angles.length} angles`,
                {
                    angleTypes: result.angles.map((angle) => angle.discourse),
                    category: result.category,
                },
            );

            // Create value objects from AI response
            const category = new Category(result.category);

            // Create angle data from AI response (without creating full ReportAngle entities)
            const angles = result.angles.map((angleData) => ({
                corpus: angleData.corpus,
                discourse: angleData.discourse,
                stance: angleData.stance,
            }));

            const ingestionResult: ReportIngestionResult = {
                angles,
                category,
                facts: result.facts,
            };

            this.logger.info(
                `[${this.name}] Successfully ingested report: ${ingestionResult.facts.substring(0, 100)}... with ${ingestionResult.angles.length} angles`,
            );

            return ingestionResult;
        } catch (error) {
            this.logger.error(`[${this.name}] Failed to ingest report`, {
                articleCount: params.newsReport.articles.length,
                error,
            });
            return null;
        }
    }
}
