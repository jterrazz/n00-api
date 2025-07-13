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
    type ArticleFalsificationAgentPort,
    type ArticleFalsificationInput,
    type ArticleFalsificationResult,
} from '../../../application/ports/outbound/agents/article-falsification.agent.js';

import { bodySchema } from '../../../domain/value-objects/article/body.vo.js';
import { headlineSchema } from '../../../domain/value-objects/article/headline.vo.js';
import { Category, categorySchema } from '../../../domain/value-objects/category.vo.js';

export class ArticleFalsificationAgentAdapter implements ArticleFalsificationAgentPort {
    static readonly SCHEMA = z.object({
        body: bodySchema,
        category: categorySchema,
        clarification: z
            .string()
            .describe(
                'Clear explanation of why this article is fabricated and what makes it misleading',
            ),
        headline: headlineSchema,
        insertAfterIndex: z
            .number()
            .int()
            .describe(
                '0-based index inside the provided recentArticles array **after** which the generated fake article should be placed. Use -1 if recentArticles is empty.',
            )
            .default(-1),
        tone: z
            .enum(['serious', 'satirical'])
            .describe('The tone/style used in the generated article'),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are a skilled content creator specialized in generating convincing but fake news articles for educational purposes. Your mission is to create plausible-sounding but fictional news content that helps users learn to identify misinformation.',
        'Write in a professional journalistic style that mimics real news outlets, but ensure the content is entirely fabricated. Focus on creating believable scenarios that could theoretically happen but are completely made up.',
        'CRITICAL: You are creating content for a fake news detection game. The articles must be clearly fake but convincing enough to be educational. Never create content that could spread actual misinformation if taken out of context.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
    );

    public readonly name = 'ArticleFalsificationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof ArticleFalsificationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleFalsificationAgentAdapter.SCHEMA,
            systemPrompt: ArticleFalsificationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleFalsificationInput) => {
        const currentDate = input.context?.currentDate || new Date();
        const recentArticles = input.context?.recentArticles || [];

        // Determine requested tone. 'random' means the AI should decide.
        const requestedTone = input.tone || 'random';

        const baseMission =
            'Your mission is to create a convincing but entirely fake news article for educational purposes. This is for a fake news detection game where users learn to identify misinformation.';

        const categoryInstruction = input.targetCategory
            ? `Required Category: ${input.targetCategory.toString()}`
            : 'Category: Choose the most appropriate category from [TECHNOLOGY, BUSINESS, POLITICS, SCIENCE, HEALTH, ENTERTAINMENT, SPORTS] based on the content you create and recent reports context.';

        const toneInstruction =
            requestedTone === 'random'
                ? 'TONE: **CHOOSE** - Decide whether **SERIOUS** (traditional fake news) or **SATIRICAL** (humorous) will best serve the educational purpose given the context. Indicate your chosen tone in the `tone` field of the output.'
                : `TONE: **${requestedTone.toUpperCase()}** - Follow the guidelines for this tone exactly.`;

        const styleGuidelines = [
            '### SERIOUS STYLE',
            '•   Professional journalistic style that appears legitimate but contains subtle misinformation.',
            '•   Believable, uses credible tone and structure.',
            '',
            '### SATIRICAL STYLE',
            '•   Humorous, absurd scenarios with deadpan delivery (e.g., The Babylon Bee, The Onion).',
            '•   Clearly fictional and exaggerated upon reflection.',
            '',
            '### CONTINUITY REQUIREMENTS',
            '•   The **overall length** (word count) and **stylistic tone** of your article must closely match recent articles in the history.',
            '•   Mirror the journalistic structure: similar paragraph count and average sentence length.',
            '•   HEADLINE: Craft a headline whose length (character count) and style are in line with the sample headlines.',
            '•   BODY: Aim for a body word count within ±10% of the average of recent article bodies.',
            '•   The `frames` data is **context only** – do NOT copy or reference frame text verbatim; instead, use it to inspire coherent misinformation.',
        ].join('\n');

        const singlePrompt = new UserPromptAdapter(
            `CRITICAL: Output MUST be in ${input.targetLanguage.toString().toUpperCase()} language.`,
            '',
            baseMission,
            '',
            toneInstruction,
            '',
            'REQUIREMENTS:',
            '•   **Entirely Fictional:** Do not base on real events, people, or organizations.',
            '•   **Educational Value:** The article should help users learn to detect misinformation.',
            '•   **Contextual Relevance:** If recent articles are provided, incorporate them subtly.',
            '',
            styleGuidelines,
            '',
            `TARGET: Country: ${input.targetCountry.toString()}, Language: ${input.targetLanguage.toString()}`,
            categoryInstruction,
            `Date: ${currentDate.toISOString()}`,
            recentArticles.length > 0 ? 'RECENT_ARTICLES:' : '',
            ...(recentArticles.length > 0 ? [JSON.stringify(recentArticles, null, 2)] : []),
            '',
            'TIMELINE INSTRUCTION:',
            '•   Analyse the timestamps of RECENT_ARTICLES. Decide **after which article** your newly generated article should appear so the chronology feels natural. Provide the index (0-based) of that article in the `insertAfterIndex` field of your JSON output.',
            '•   If there are no recent articles, set `insertAfterIndex` to -1.',
            '',
            'OUTPUT: Return a JSON object with the fields { headline, body, clarification, category, tone, insertAfterIndex }.',
        );

        return singlePrompt;
    };

    async run(input: ArticleFalsificationInput): Promise<ArticleFalsificationResult | null> {
        try {
            this.logger.info(`[${this.name}] Generating fake article`, {
                category: input.targetCategory?.toString() || 'AI will choose',
                country: input.targetCountry.toString(),
                language: input.targetLanguage.toString(),
            });

            const result = await this.agent.run(
                ArticleFalsificationAgentAdapter.USER_PROMPT(input),
            );

            if (!result) {
                this.logger.warn(`[${this.name}] No result from AI model`);
                return null;
            }

            // Validate that the category matches if it was specified
            if (input.targetCategory && result.category !== input.targetCategory.value) {
                this.logger.warn(
                    `[${this.name}] AI returned category ${result.category} but expected ${input.targetCategory.value}`,
                );
                return null;
            }

            // Log successful generation for debugging
            this.logger.info(`[${this.name}] Successfully generated fake article`, {
                bodyLength: result.body.length,
                category: result.category,
                headline: result.headline,
            });

            const fakerResult: ArticleFalsificationResult = {
                body: result.body,
                category: new Category(result.category),
                clarification: result.clarification,
                headline: result.headline,
                insertAfterIndex: result.insertAfterIndex,
                tone: result.tone,
            };

            this.logger.info(
                `[${this.name}] Successfully generated fake article: "${fakerResult.headline}" (${fakerResult.body.length} chars)`,
            );

            return fakerResult;
        } catch (error) {
            this.logger.error(`[${this.name}] Failed to generate fake article`, {
                error,
                targetCategory: input.targetCategory?.toString() || 'AI will choose',
                targetCountry: input.targetCountry.toString(),
                targetLanguage: input.targetLanguage.toString(),
            });
            return null;
        }
    }
}
