import {
    ChatAgent,
    type ModelPort,
    PROMPTS,
    SystemPrompt,
    UserPrompt,
} from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

// Application
import {
    type ArticleFabricationAgentPort,
    type ArticleFabricationInput,
    type ArticleFabricationResult,
} from '../../../application/ports/outbound/agents/article-fabrication.agent.js';

// Domain
import { bodySchema } from '../../../domain/value-objects/article/body.vo.js';
import { headlineSchema } from '../../../domain/value-objects/article/headline.vo.js';
import { Categories } from '../../../domain/value-objects/categories.vo.js';
import { categorySchema } from '../../../domain/value-objects/category.vo.js';

export class ArticleFabricationAgent implements ArticleFabricationAgentPort {
    static readonly SCHEMA = z.object({
        body: bodySchema,
        category: categorySchema,
        clarification: z.string(),
        headline: headlineSchema,
        insertAfterIndex: z.number().int().default(-1),
        tone: z.enum(['satirical']),
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ArticleFabricationAgent';

    private readonly agent: ChatAgent<z.infer<typeof ArticleFabricationAgent.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleFabricationAgent.SCHEMA,
            systemPrompt: ArticleFabricationAgent.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleFabricationInput) => {
        const currentDate = input.context?.currentDate || new Date();
        const recentArticles = input.context?.recentArticles || [];

        return new UserPrompt(
            // Role & Mission
            'You are a senior editorial simulator specializing in crafting convincing but completely fabricated news articles for an educational fake-news-detection game.',
            '',
            'Your purpose: entertain and educate by showing how misinformation can look credible, while never risking real-world harm. Content must be plausible, professional, and journalistic in tone, yet entirely fictional and safe.',
            '',
            `CRITICAL: All output MUST be written in ${input.targetLanguage.toString().toUpperCase()}.`,
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',

            // Content Strategy
            '=== CONTENT STRATEGY ===',
            '',
            '**Educational Purpose**: Create fictional content that teaches fake news detection',
            '- Users will attempt to identify why the article is misleading',
            '- Must be convincing enough to challenge critical thinking',
            '- Reveal fabrication techniques without causing real-world harm',
            '',
            '**Satirical Style** (Default approach):',
            '- Dead-pan humor with absurd premise delivered in straight-news voice',
            '- Satirical content',
            '- Must punch upward—target institutions or powerful figures, never marginalized groups',
            '',

            // Writing Techniques
            '=== WRITING TECHNIQUES ===',
            '',
            '**Ski Jump Rule**: Hide the twist until final 2-4 syllables of headline',
            '',
            '**Big/Small Switch**: Either treat monumental events with pedestrian seriousness OR trivial stories with outsized gravitas',
            '',
            '**Specificity & Plausibility**:',
            '- Include at least TWO concrete, believable details',
            '- Examples: "14-page ordinance", "Gallup poll of 1,028 voters"',
            '- Attribute at least one quote to named (fictional) expert or agency',
            '',
            '**Linguistic Balance**: Blend analytic phrasing with one emotionally loaded clause for believability',
            '',

            // Content Standards
            '=== CONTENT STANDARDS ===',
            '',
            '**Continuity Rules**:',
            '- Target body length: ~200 words (160-240 word range acceptable)',
            '- Match headline length to recent articles or use 8-12 words if none',
            '- Never start body with datelines (e.g., "January 15 -", "PARIS, Jan 15 -") - dates are displayed separately as metadata',
            '',
            '**Category Selection**: Choose most appropriate category',
            '',

            // Output Requirements
            '=== OUTPUT REQUIREMENTS ===',
            '',
            '• **headline** → Click-worthy headline matching satirical tone',
            '• **body** → Article body following continuity rules',
            '• **clarification** → Post-guess explanation of why/how article is misleading',
            '• **category** → Most appropriate category',
            '• **tone** → "satirical" (current default)',
            '• **insertAfterIndex** → Chronological placement index or -1 if no recent articles',
            '',

            // Critical Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Complete Fabrication**: Story must be 100% fictional—no real events or people',
            '• **Convincing Presentation**: Should fool average reader initially',
            '• **Hidden Fabrication**: Do NOT reveal within article that it is fake',
            '• **Safe Content**: Never risk real-world harm or target vulnerable groups',
            '• **Educational Value**: Demonstrate misinformation techniques clearly',
            '',

            // Context Data
            '=== CONTEXT DATA ===',
            '',
            `**Target**: ${input.targetCountry.toString()} | ${input.targetLanguage.toString()}`,
            `**Date**: ${currentDate.toISOString()}`,
            '',
            ...(recentArticles.length > 0
                ? [
                      '**Recent Articles for Continuity**:',
                      JSON.stringify(recentArticles, null, 2),
                      '',
                      '**Timeline Instruction**: Analyze timestamps and provide insertAfterIndex for natural chronological flow',
                  ]
                : ['**No Recent Articles**: Use default sizing guidelines']),
        );
    };

    async run(input: ArticleFabricationInput): Promise<ArticleFabricationResult | null> {
        try {
            this.logger.info('Generating fabricated article', {
                country: input.targetCountry.toString(),
                language: input.targetLanguage.toString(),
            });

            const result = await this.agent.run(ArticleFabricationAgent.USER_PROMPT(input));

            if (!result) {
                this.logger.warn('Fabrication agent returned no result');
                return null;
            }

            // Log successful generation for debugging
            this.logger.info('Fake article generated successfully', {
                bodyLength: result.body.length,
                categories: result.category,
                headline: result.headline,
            });

            const fakerResult: ArticleFabricationResult = {
                body: result.body,
                categories: new Categories([result.category]),
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
