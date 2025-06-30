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
    type StoryDigestAgentPort,
    type StoryDigestResult,
} from '../../../application/ports/outbound/agents/story-digest.agent.js';
import { type NewsStory } from '../../../application/ports/outbound/providers/news.port.js';

import { synopsisSchema } from '../../../domain/entities/story.entity.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { categorySchema } from '../../../domain/value-objects/category.vo.js';
import { HolisticDigest } from '../../../domain/value-objects/perspective/holistic-digest.vo.js';
import { holisticDigestSchema } from '../../../domain/value-objects/perspective/holistic-digest.vo.js';
import {
    discourseTypeSchema,
    PerspectiveTags,
    stanceSchema,
} from '../../../domain/value-objects/perspective/perspective-tags.vo.js';

export class StoryDigestAgentAdapter implements StoryDigestAgentPort {
    static readonly SCHEMA = z.object({
        category: categorySchema,
        perspectives: z
            .array(
                z.object({
                    holisticDigest: holisticDigestSchema.describe(
                        'A complete compilation of all information for this viewpoint, NOT a summary. Must include every argument, fact, and piece of evidence presented for this side.',
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

    public readonly name = 'StoryDigestAgent';

    private readonly agent: BasicAgentAdapter<z.infer<typeof StoryDigestAgentAdapter.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: StoryDigestAgentAdapter.SCHEMA,
            systemPrompt: StoryDigestAgentAdapter.SYSTEM_PROMPT,
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
            '    a.  **holisticDigest:** This is NOT a summary. It must be a **complete compilation of all information** for that specific viewpoint. Gather every argument, fact, and piece of evidence presented *for that side*.',
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

    async run(params: { newsStory: NewsStory }): Promise<null | StoryDigestResult> {
        try {
            this.logger.info(
                `[${this.name}] Digesting story with ${params.newsStory.articles.length} articles`,
            );

            const result = await this.agent.run(
                StoryDigestAgentAdapter.USER_PROMPT(params.newsStory),
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
                holisticDigest: new HolisticDigest(perspectiveData.holisticDigest),
                tags: new PerspectiveTags({
                    discourse_type: perspectiveData.tags.discourse_type,
                    stance: perspectiveData.tags.stance,
                }),
            }));

            const digestResult: StoryDigestResult = {
                category,
                perspectives,
                synopsis: result.synopsis,
            };

            this.logger.info(
                `[${this.name}] Successfully digested story: ${digestResult.synopsis.substring(0, 100)}... with ${digestResult.perspectives.length} perspectives`,
            );

            return digestResult;
        } catch (error) {
            this.logger.error(`[${this.name}] Failed to digest story`, {
                articleCount: params.newsStory.articles.length,
                error,
            });
            return null;
        }
    }
}
