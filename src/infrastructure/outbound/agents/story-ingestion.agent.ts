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
    type StoryIngestionAgentPort,
    type StoryIngestionResult,
} from '../../../application/ports/outbound/agents/story-ingestion.agent.js';
import { type NewsStory } from '../../../application/ports/outbound/providers/news.port.js';

import { synopsisSchema } from '../../../domain/entities/story.entity.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { categorySchema } from '../../../domain/value-objects/category.vo.js';
import { PerspectiveCorpus } from '../../../domain/value-objects/story/perspective/perspective-corpus.vo.js';
import { perspectiveCorpusSchema } from '../../../domain/value-objects/story/perspective/perspective-corpus.vo.js';
import {
    discourseTypeSchema,
    stanceSchema,
} from '../../../domain/value-objects/story/perspective/perspective-tags.vo.js';

export class StoryIngestionAgentAdapter implements StoryIngestionAgentPort {
    static readonly SCHEMA = z.object({
        category: categorySchema,
        perspectives: z
            .array(
                z.object({
                    perspectiveCorpus: perspectiveCorpusSchema.describe(
                        'A complete compilation of all information for this viewpoint, NOT a summary. It must be focused on the news event itself and include every argument, fact, and piece of evidence presented for this side. It MUST NOT contain information about the news source.',
                    ),
                    tags: z.object({
                        discourse_type: discourseTypeSchema,
                        stance: stanceSchema,
                    }),
                }),
            )
            .min(1, 'At least one perspective is required.')
            .max(2, 'No more than two perspectives should be created.'),
        synopsis: synopsisSchema,
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are a master investigative journalist and media analyst. Your core mission is to analyze news articles and deconstruct them into a structured intelligence brief, identifying the core facts and the distinct perspectives presented.',
        'Your analysis must be objective and based solely on the provided text. You do not judge viewpoints; you identify and categorize them. Your primary goal is to find **genuinely distinct or opposing viewpoints** to map the landscape of the public debate, not to find minor variations of the same argument.',
        PROMPT_LIBRARY.PERSONAS.JOURNALIST,
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.LANGUAGES.ENGLISH_NATIVE,
        'CRITICAL: Output MUST be in English.',
        PROMPT_LIBRARY.TONES.NEUTRAL,
        PROMPT_LIBRARY.VERBOSITY.DETAILED,
    );

    public readonly name = 'StoryIngestionAgent';

    private readonly agent: BasicAgentAdapter<z.infer<typeof StoryIngestionAgentAdapter.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: StoryIngestionAgentAdapter.SCHEMA,
            systemPrompt: StoryIngestionAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (newsStory: NewsStory) =>
        new UserPromptAdapter(
            // Core Mission
            'Analyze the following news articles about a single event and deconstruct them into a structured intelligence brief.',
            '',

            // The "What" - Required Output
            'Your output MUST contain two parts:',
            '1.  **Synopsis:** A comprehensive, neutral summary of the core facts. What happened, who was involved, where, and when. Prioritize factual completeness.',
            '2.  **Perspectives:** Identify the 1 or 2 most dominant perspectives presented in the articles. For each perspective, provide:',
            '    a.  **perspectiveCorpus:** This is NOT a summary. It must be a **complete compilation of all information** for that specific viewpoint, focused *only on the news event*. Gather every argument, fact, and piece of evidence presented *for that side*. It MUST NOT contain information about the news source itself.',
            "    b.  **tags:** Classify the perspective's `stance` and `discourse_type`.",
            '',

            // The "How" - Your Analysis Guidelines
            'Follow these analysis guidelines:',
            '•   **Be an Objective Analyst:** Do not judge the viewpoints, simply identify and categorize them based on the text.',
            '•   **Analyze Inter-Perspective Dynamics:** To determine the `discourse_type`, your goal is to map the main lines of public debate. Identify which discourse represents the dominant media narrative and which represents its primary contradiction.',
            '•   **Use These Discourse Definitions:**',
            '    -   **MAINSTREAM:** The narrative of the dominant media. This is the most common and widely amplified storyline.',
            '    -   **ALTERNATIVE:** The narrative of the contradictory media. This viewpoint directly challenges or offers a significant counterpoint to the mainstream narrative, while still being visible in the public sphere.',
            '    -   (Do not use other discourse types for now).',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '•   **Focus on the Story:** Perspectives MUST be about the central news event. Do not create perspectives about the news publications, their missions, or their general stances. The analysis must be about the story, not the storyteller.',
            '•   Base your entire analysis **only** on the provided articles. Do not add external information.',
            '•   Identify a **maximum of 2** perspectives. Only create a perspective if it is genuinely distinct from the other.',
            '•   **No Redundant Perspectives:** If multiple sources make the same core argument, treat them as ONE perspective. Do not create separate perspectives for sources that are on the same "side" or from the same "camp".',
            '',

            // Data input
            'NEWS ARTICLES TO ANALYZE:',
            JSON.stringify(
                newsStory.articles.map((article) => ({
                    body: article.body,
                    headline: article.headline,
                })),
                null,
                2,
            ),
        );

    async run(params: { newsStory: NewsStory }): Promise<null | StoryIngestionResult> {
        try {
            this.logger.info(
                `[${this.name}] Ingesting story with ${params.newsStory.articles.length} articles`,
            );

            const result = await this.agent.run(
                StoryIngestionAgentAdapter.USER_PROMPT(params.newsStory),
            );

            if (!result) {
                this.logger.warn(`[${this.name}] No result from AI model`);
                return null;
            }

            // Log successful parsing for debugging
            this.logger.info(
                `[${this.name}] Successfully parsed AI response with ${result.perspectives.length} perspectives`,
                {
                    category: result.category,
                    perspectiveTypes: result.perspectives.map((p) => p.tags.discourse_type),
                },
            );

            // Create value objects from AI response
            const category = new Category(result.category);

            // Create perspective data from AI response (without creating full Perspective entities)
            const perspectives = result.perspectives.map((perspectiveData) => ({
                discourse: perspectiveData.tags.discourse_type,
                perspectiveCorpus: new PerspectiveCorpus(perspectiveData.perspectiveCorpus),
                stance: perspectiveData.tags.stance,
            }));

            const ingestionResult: StoryIngestionResult = {
                category,
                perspectives,
                synopsis: result.synopsis,
            };

            this.logger.info(
                `[${this.name}] Successfully ingested story: ${ingestionResult.synopsis.substring(0, 100)}... with ${ingestionResult.perspectives.length} perspectives`,
            );

            return ingestionResult;
        } catch (error) {
            this.logger.error(`[${this.name}] Failed to ingest story`, {
                articleCount: params.newsStory.articles.length,
                error,
            });
            return null;
        }
    }
}
