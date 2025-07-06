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
    type ArticleCompositionAgentPort,
    type ArticleCompositionInput,
    type ArticleCompositionResult,
} from '../../../application/ports/outbound/agents/article-composition.agent.js';

import { bodySchema } from '../../../domain/value-objects/article/body.vo.js';
import { headlineSchema } from '../../../domain/value-objects/article/headline.vo.js';

export class ArticleCompositionAgentAdapter implements ArticleCompositionAgentPort {
    static readonly SCHEMA = z.object({
        body: bodySchema,
        headline: headlineSchema,
        variants: z
            .array(
                z.object({
                    body: bodySchema,
                    headline: headlineSchema,
                }),
            )
            .describe(
                'You MUST return one variant for EACH perspective in the input. The length of this array MUST match the number of perspectives provided.',
            ),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are an expert content composer and journalistic writer. Your mission is to transform structured story data into compelling articles: a neutral main article presenting only facts, plus variants representing different viewpoints.',
        'Adopt the style of a quality newspaper: professional and authoritative, yet written in clear, simple words for a broad audience. Your tone should be neutral and objective.',
        PROMPT_LIBRARY.PERSONAS.JOURNALIST,
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
    );

    public readonly name = 'ArticleCompositionAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof ArticleCompositionAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleCompositionAgentAdapter.SCHEMA,
            systemPrompt: ArticleCompositionAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleCompositionInput) => {
        const expectedVariantCount = input.story.perspectives.length;

        return new UserPromptAdapter(
            // Hard constraint
            `CRITICAL: Output MUST be in ${input.targetLanguage.toString().toUpperCase()} language.`,
            '',

            // Core Mission & Audience
            'Your mission is to write content for a mobile app that helps users understand all sides of a story. The content must be engaging, concise, and perfectly clear for a broad audience.',
            '',

            // The Hierarchical Content Model (The "What")
            'You will create two types of content that are **complementary and do not repeat information**:',
            '1.  **Main Article (The Foundation):** A neutral summary of the core, undisputed facts. This is the baseline "what happened" that is shown first. It contains information all sides agree on.',
            `2.  **Variants (The Perspectives):** Create **exactly ${expectedVariantCount}** complementary articles, one for each perspective. These must **build upon** the main article's facts, not repeat them. Your goal here is to explain **how that perspective interprets or emphasizes those facts**. Focus on the "why" behind their viewpoint.`,
            '',

            // Your Role as an Editor (The "How")
            'Act as a skilled editor:',
            "•   **Curate, Don't Transcribe:** Use your editorial judgment to select only the **most pertinent and interesting** information. Omit minor details.",
            '•   **Clarity is Paramount:** Write in simple, crystal-clear language. Use well-articulated phrases that are easy for anyone to understand. Avoid all jargon.',
            '•   **Engage with Key Phrases:** Craft compelling headlines and use strong key phrases to make the content engaging and memorable.',
            '•   **Pacing and Length:** The goal is a total read time of about **one minute**. Aim for a concise Main Article (~60-80 words) and brief, impactful Variants (~30-50 words each). These are flexible targets; prioritize clarity and pertinence over sticking to exact word counts.',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            `•   You **MUST** create **exactly ${expectedVariantCount}** variants, one for each perspective in the input. Do not combine or omit any.`,
            '•   Base all content **only** on the provided story data.',
            '•   **NO REPETITION:** The Main Article contains the core facts. The Variants provide the interpretation. Do not repeat information between them. The user reads them together.',
            '',

            // Story data input
            'STORY DATA FOR COMPOSITION:',
            JSON.stringify(
                {
                    dateline: input.story.dateline.toISOString(),
                    perspectives: input.story.perspectives.map((perspective) => ({
                        digest: perspective.perspectiveCorpus.value,
                        discourse: perspective.tags.tags.discourse_type,
                        stance: perspective.tags.tags.stance,
                    })),
                },
                null,
                2,
            ),
        );
    };

    async run(input: ArticleCompositionInput): Promise<ArticleCompositionResult | null> {
        try {
            this.logger.info(
                `[${this.name}] Composing article for story with ${input.story.perspectives.length} perspectives`,
                {
                    country: input.targetCountry.toString(),
                    language: input.targetLanguage.toString(),
                    storyCategory: input.story.category.toString(),
                },
            );

            const result = await this.agent.run(ArticleCompositionAgentAdapter.USER_PROMPT(input));

            if (!result) {
                this.logger.warn(`[${this.name}] No result from AI model`);
                return null;
            }

            // Validate that we have the correct number of variants
            if (result.variants.length !== input.story.perspectives.length) {
                this.logger.warn(
                    `[${this.name}] AI returned ${result.variants.length} variants but expected ${input.story.perspectives.length} (one per perspective)`,
                );
                return null;
            }

            // Log successful composition for debugging
            this.logger.info(`[${this.name}] Successfully composed article with variants`, {
                bodyLength: result.body.length,
                headlineLength: result.headline.length,
                variantsCount: result.variants.length,
            });

            const compositionResult: ArticleCompositionResult = {
                body: result.body,
                headline: result.headline,
                variants: result.variants.map((variant, index) => {
                    const perspective = input.story.perspectives[index];
                    return {
                        body: variant.body,
                        discourse: perspective.tags.tags.discourse_type || 'mainstream',
                        headline: variant.headline,
                        stance: perspective.tags.tags.stance || 'neutral',
                    };
                }),
            };

            this.logger.info(
                `[${this.name}] Successfully composed article: "${compositionResult.headline}" (${compositionResult.body.length} chars) with ${compositionResult.variants.length} variants`,
            );

            return compositionResult;
        } catch (error) {
            this.logger.error(`[${this.name}] Failed to compose article`, {
                error,
                storyId: input.story.id,
                targetCountry: input.targetCountry.toString(),
                targetLanguage: input.targetLanguage.toString(),
            });
            return null;
        }
    }
}
