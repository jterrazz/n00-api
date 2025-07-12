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
        'You are a master investigative journalist and media analyst. Your core mission is to analyze news articles and deconstruct them into a structured intelligence brief, identifying the core facts and the distinct angles presented.',
        'Your analysis must be objective and based solely on the provided text. You do not judge viewpoints; you identify and categorize them. Your primary goal is to find **genuinely distinct or opposing viewpoints** to map the landscape of the public debate, not to find minor variations of the same argument.',
        PROMPT_LIBRARY.PERSONAS.JOURNALIST,
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.LANGUAGES.ENGLISH_NATIVE,
        'CRITICAL: Output MUST be in English.',
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
            'Analyze the following news articles about a single event and deconstruct them into a structured intelligence brief.',
            '',

            // The "What" - Required Output
            'Your output MUST contain two parts:',
            '1.  **Facts:** A comprehensive, neutral summary of the core facts. What happened, who was involved, where, and when. Prioritize factual completeness.',
            '2.  **Angles:** Identify the 1 or 2 most dominant angles presented in the articles. For each angle, provide:',
            '    a.  **corpus:** This is NOT a summary. It must be a **complete compilation of all information** for that specific viewpoint, focused *only on the news event*. Gather every argument, fact, and piece of evidence presented *for that side*. It MUST NOT contain information about the news source itself.',
            "    b.  **tags:** Classify the angle's `stance` and `discourse_type`.",
            '',

            // The "How" - Your Analysis Guidelines
            'Follow these analysis guidelines:',
            '•   **Be an Objective Analyst:** Do not judge the viewpoints, simply identify and categorize them based on the text.',
            '•   **Analyze Inter-Angle Dynamics:** To determine the `discourse_type`, your goal is to map the main lines of public debate. Identify which discourse represents the dominant media narrative and which represents its primary contradiction.',
            '•   **Use These Discourse Definitions:**',
            '    -   **MAINSTREAM:** The narrative of the dominant media. This is the most common and widely amplified narrative.',
            '    -   **ALTERNATIVE:** The narrative of the contradictory media. This viewpoint directly challenges or offers a significant counterpoint to the mainstream narrative, while still being visible in the public sphere.',
            '    -   (Do not use other discourse types for now).',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '•   **Focus on the Report:** Angles MUST be about the central news event. Do not create angles about the news publications, their missions, or their general stances. The analysis must be about the report, not the storyteller.',
            '•   Base your entire analysis **only** on the provided articles. Do not add external information.',
            '•   Identify a **maximum of 2** angles. Only create an angle if it is genuinely distinct from the other.',
            '•   **No Redundant Angles:** If multiple sources make the same core argument, treat them as ONE angle. Do not create separate angles for sources that are on the same "side" or from the same "camp".',
            '',

            // Data input
            'NEWS ARTICLES TO ANALYZE:',
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
