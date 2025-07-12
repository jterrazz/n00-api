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
    type ArticleFakerAgentPort,
    type ArticleFakerInput,
    type ArticleFakerResult,
} from '../../../application/ports/outbound/agents/article-faker.agent.js';

import { bodySchema } from '../../../domain/value-objects/article/body.vo.js';
import { headlineSchema } from '../../../domain/value-objects/article/headline.vo.js';
import { Category, categorySchema } from '../../../domain/value-objects/category.vo.js';

export class ArticleFakerAgentAdapter implements ArticleFakerAgentPort {
    static readonly SCHEMA = z.object({
        body: bodySchema,
        category: categorySchema,
        fakeReason: z
            .string()
            .describe('Clear explanation of why this article is fake and what makes it misleading'),
        headline: headlineSchema,
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

    public readonly name = 'ArticleFakerAgent';

    private readonly agent: BasicAgentAdapter<z.infer<typeof ArticleFakerAgentAdapter.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleFakerAgentAdapter.SCHEMA,
            systemPrompt: ArticleFakerAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleFakerInput) => {
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
            'OUTPUT: Return a JSON object with the fields { headline, body, fakeReason, category, tone }.',
        );

        return singlePrompt;
    };

    async run(input: ArticleFakerInput): Promise<ArticleFakerResult | null> {
        try {
            this.logger.info(`[${this.name}] Generating fake article`, {
                category: input.targetCategory?.toString() || 'AI will choose',
                country: input.targetCountry.toString(),
                language: input.targetLanguage.toString(),
            });

            const result = await this.agent.run(ArticleFakerAgentAdapter.USER_PROMPT(input));

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

            const fakerResult: ArticleFakerResult = {
                body: result.body,
                category: new Category(result.category),
                fakeReason: result.fakeReason,
                headline: result.headline,
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
