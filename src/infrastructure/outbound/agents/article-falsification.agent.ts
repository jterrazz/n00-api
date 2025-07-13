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
        'You are a senior editorial simulator specialising in crafting **convincing but completely fabricated** news articles for an educational fake-news-detection game.',
        'Your purpose is twofold: 1) entertain and educate by showing how misinformation can look credible, 2) never risk real-world harm. The content must be plausible, professional, and journalistic in tone, yet entirely fictional and safe.',
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
        const toneInstruction =
            'TONE: **SATIRICAL ONLY** – Generate content in a dead-pan, absurdist style reminiscent of The Onion or Babylon Bee.';

        const categoryInstruction =
            'CATEGORY: Choose the single most appropriate category from [TECHNOLOGY, BUSINESS, POLITICS, SCIENCE, HEALTH, ENTERTAINMENT, SPORTS].';

        const styleGuidelines = [
            '### SATIRICAL STYLE (DEFAULT)',
            '•   Dead-pan humour, absurd premise delivered in a straight-news voice.',
            '',
            '### SKI_JUMP RULE',
            'Hide the twist until the final 2-4 syllables of the headline.',
            '',
            '### BIG/SMALL SWITCH',
            'Either treat monumental events with pedestrian seriousness OR trivial stories with outsized gravitas.',
            '',
            '### SPECIFICITY & PLAUSIBILITY',
            '•   Include at least TWO concrete, believable details ("14-page ordinance", "Gallup poll of 1,028 voters").',
            '•   Attribute at least one quote to a named (fictional) expert or agency.',
            '',
            '### LINGUISTIC BALANCE',
            'Blend analytic phrasing with one emotionally loaded clause for believability.',
            '',
            '### CONTINUITY RULES',
            '•   Match headline length (8-16 words) and body word-count to recentArticles average (±10%).',
            '•   If no recentArticles, aim for headline 8-16 words and body 40-100 words.',
        ].join('\n');

        return new UserPromptAdapter(
            // Language Constraint
            `CRITICAL: All output MUST be written in ${input.targetLanguage.toString().toUpperCase()}.`,
            '',

            // Core Mission
            'Create a **completely fictional** yet **plausible** news article for our fake-news-detection game. Users will try to spot why it is misleading.',
            '',

            // Output Structure
            'OUTPUT STRUCTURE (JSON): { headline, body, clarification, category, tone, insertAfterIndex }',
            '• headline → Click-worthy headline (8-16 words) matching chosen tone.',
            '• body → Article body with word-count matching continuity rules.',
            '• clarification → One sentence explaining *why* and *how* the article is misleading.',
            '• category → As instructed in CATEGORY.',
            '• tone → "serious" or "satirical".',
            '• insertAfterIndex → Index after which this article fits chronologically in recentArticles, or -1 if none.',
            '',

            // Tone & Category Instructions
            toneInstruction,
            categoryInstruction,
            '',

            // Style Guidelines
            'STYLE GUIDELINES:',
            styleGuidelines,
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '• The story must be 100% fabricated — no real events or people presented as fact.',
            '• Do NOT reveal within the article that it is fake.',
            '• Ensure the piece would be convincing to an average reader.',
            '• Satire must punch **upward** – target institutions or powerful figures, never marginalised groups.',
            '',

            // Context & Timing
            `TARGET: Country: ${input.targetCountry.toString()}, Language: ${input.targetLanguage.toString()}`,
            `DATE: ${currentDate.toISOString()}`,
            recentArticles.length > 0 ? 'RECENT_ARTICLES:' : '',
            ...(recentArticles.length > 0 ? [JSON.stringify(recentArticles, null, 2)] : []),
            '',
            'TIMELINE INSTRUCTION:',
            '•   Analyse timestamps of RECENT_ARTICLES and provide `insertAfterIndex` so chronology feels natural.',
        );
    };

    async run(input: ArticleFalsificationInput): Promise<ArticleFalsificationResult | null> {
        try {
            this.logger.info('Generating fabricated article', {
                country: input.targetCountry.toString(),
                language: input.targetLanguage.toString(),
            });

            const result = await this.agent.run(
                ArticleFalsificationAgentAdapter.USER_PROMPT(input),
            );

            if (!result) {
                this.logger.warn('Falsification agent returned no result');
                return null;
            }

            // Log successful generation for debugging
            this.logger.info('Fake article generated successfully', {
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
                `Generated fake article: "${fakerResult.headline}" (${fakerResult.body.length} chars)`,
            );

            return fakerResult;
        } catch (error) {
            this.logger.error('Failed to generate fake article', {
                error,
                targetCountry: input.targetCountry.toString(),
                targetLanguage: input.targetLanguage.toString(),
            });
            return null;
        }
    }
}
