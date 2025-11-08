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
    type ArticleCompositionAgentPort,
    type ArticleCompositionInput,
    type ArticleCompositionResult,
} from '../../../application/ports/outbound/agents/article-composition.agent.js';

// Domain
import { bodySchema } from '../../../domain/value-objects/article/body.vo.js';
import { headlineSchema } from '../../../domain/value-objects/article/headline.vo.js';

export class ArticleCompositionAgent implements ArticleCompositionAgentPort {
    static readonly SCHEMA = z.object({
        body: bodySchema,
        frames: z.array(
            z.object({
                body: bodySchema,
                headline: headlineSchema,
            }),
        ),
        headline: headlineSchema,
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ArticleCompositionAgent';

    private readonly agent: ChatAgent<z.infer<typeof ArticleCompositionAgent.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleCompositionAgent.SCHEMA,
            systemPrompt: ArticleCompositionAgent.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleCompositionInput) => {
        const expectedFrameCount = input.report.angles.length;

        return new UserPrompt(
            // Role & Mission
            'You are a senior editorial writer and narrative composer for a global news application. Your mission: convert structured report data into compelling news packages for mobile readers.',
            '',
            'Write in clear, authoritative newspaper style—professional yet accessible. Create a neutral main article with verified facts, plus viewpoint frames that build on (never repeat) the core facts.',
            '',
            `CRITICAL: All output MUST be written in ${input.targetLanguage.toString().toUpperCase()}.`,
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',

            // Content Structure
            '=== CONTENT STRUCTURE ===',
            '',
            '**Main Article**: Neutral foundation of verified facts',
            '- Present undisputed information only',
            '- 20-150 words, information-dense',
            '- Strict neutrality, no interpretation',
            '',
            '**Frames**: Viewpoint-specific interpretations',
            `- Create exactly ${expectedFrameCount} frames (one per angle provided)`,
            '- 20-100 words each, perspective-focused',
            '- Expand on facts without repetition',
            '- Each frame represents a distinct viewpoint',
            '',

            // Writing Guidelines
            '=== WRITING GUIDELINES ===',
            '',
            '**Editorial Standards**:',
            "- Curate, don't transcribe—select most pertinent details",
            '- Simple, jargon-free language accessible to broad audience',
            '- Vivid, memorable headlines that engage readers',
            '',
            '**Content Separation**:',
            '- Main Article = facts only',
            '- Frames = interpretation and perspective',
            '- Zero repetition between main article and frames',
            '- Each frame focuses on its specific angle',
            '- Never start body with datelines (e.g., "January 15 -", "PARIS, Jan 15 -") - dates are displayed separately as metadata',
            '',

            // Formatting Standards
            '=== FORMATTING STANDARDS ===',
            '',
            '**Markdown Usage**:',
            '- Double newlines to separate paragraphs',
            '- **Bold** for crucial facts, numbers, key developments',
            '- *Italic* for subtle emphasis, context, perspective nuances',
            '- Apply formatting sparingly for enhanced readability',
            '',

            // Output Requirements
            '=== OUTPUT REQUIREMENTS ===',
            '',
            '• **headline** → Compelling main article headline',
            '• **body** → Main article with verified facts only',
            `• **frames** → Array of exactly ${expectedFrameCount} viewpoint frames`,
            '    • Each frame: headline + body',
            '    • Each frame represents one provided angle',
            '',

            // Critical Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Source Fidelity**: Use only supplied report data—no external information',
            '• **Frame Completeness**: Must create one frame per angle provided',
            '• **Content Separation**: Facts in main article, interpretation in frames',
            '• **Language Consistency**: All content in specified target language',
            '',

            // Data Input
            '=== REPORT DATA ===',
            '',
            JSON.stringify(
                {
                    angles: input.report.angles.map((angle) => ({
                        narrative: angle.narrative.value,
                    })),
                    background: input.report.background.value,
                    core: input.report.core.value,
                    dateline: input.report.dateline.toISOString(),
                },
                null,
                2,
            ),
        );
    };

    async run(input: ArticleCompositionInput): Promise<ArticleCompositionResult | null> {
        try {
            this.logger.info(
                `Composing article for report with ${input.report.angles.length} angles`,
                {
                    category: input.report.categories.primary().toString(),
                    country: input.targetCountry.toString(),
                    language: input.targetLanguage.toString(),
                },
            );

            const result = await this.agent.run(ArticleCompositionAgent.USER_PROMPT(input));

            if (!result) {
                this.logger.warn('Article composition agent returned no result');
                return null;
            }

            // Validate that we have the correct number of frames
            if (result.frames.length !== input.report.angles.length) {
                this.logger.warn(
                    `AI returned ${result.frames.length} frames but expected ${input.report.angles.length} (one per angle)`,
                );
                return null;
            }

            // Log successful composition for debugging
            this.logger.info('Successfully composed article with frames', {
                bodyLength: result.body.length,
                framesCount: result.frames.length,
                headlineLength: result.headline.length,
            });

            const compositionResult: ArticleCompositionResult = {
                body: result.body,
                frames: result.frames.map((frame) => ({
                    body: frame.body,
                    headline: frame.headline,
                })),
                headline: result.headline,
            };

            this.logger.info(
                `Article composed: "${compositionResult.headline}" (${compositionResult.body.length} chars) with ${compositionResult.frames.length} frames`,
            );

            return compositionResult;
        } catch (error) {
            this.logger.error('Failed to compose article', {
                error,
                reportId: input.report.id,
                targetCountry: input.targetCountry.toString(),
                targetLanguage: input.targetLanguage.toString(),
            });
            return null;
        }
    }
}
