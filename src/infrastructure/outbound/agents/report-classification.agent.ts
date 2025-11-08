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
    classificationSchema,
    type ReportClassificationAgentPort,
    type ReportClassificationInput,
    type ReportClassificationResult,
} from '../../../application/ports/outbound/agents/report-classification.agent.js';

// Domain
import { ArticleTraits } from '../../../domain/value-objects/article-traits.vo.js';
import { Classification as ClassificationVO } from '../../../domain/value-objects/report/tier.vo.js';

export class ReportClassificationAgent implements ReportClassificationAgentPort {
    static readonly SCHEMA = z.object({
        classification: classificationSchema,
        reason: z.string(),
        traits: z.object({
            essential: z.boolean().default(false),
            positive: z.boolean().default(false),
        }),
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ReportClassificationAgent';

    private readonly agent: ChatAgent<z.infer<typeof ReportClassificationAgent.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ReportClassificationAgent.SCHEMA,
            systemPrompt: ReportClassificationAgent.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ReportClassificationInput) => {
        const { report } = input;
        const reportData = {
            angles: report.angles?.map((angle) => ({
                narrative: angle.narrative.value,
            })),
            background: report.background.value,
            category: report.categories.primary().toString(),
            core: report.core.value,
        };

        return new UserPrompt(
            // Core Mission
            'Classify news reports for optimal content strategy and audience targeting. Apply rigorous editorial judgment to distinguish broad mainstream appeal from specialized content.',
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',

            // Three-Tier Classification System
            '=== CLASSIFICATION SYSTEM ===',
            '',
            '**GENERAL** - Broad public interest:',
            '• National/international relevance, prime-time TV worthy',
            '• Appeals across diverse demographics and regions',
            '',
            '**NICHE** - Specialized audience value:',
            '• Industry-specific, hobby-focused, or demographically targeted',
            '• Limited mainstream crossover but valuable to its audience',
            '',
            '**OFF_TOPIC** - Lacks news substance:',
            '• Lifestyle advice, entertainment without news angle',
            '• Pseudoscience, horoscopes, promotional material',
            '• Opinion without factual foundation or listicles',
            '',

            // Smart Evaluation Process
            '=== EVALUATION PROCESS ===',
            '',
            '**Content Assessment**: Core topic, factual substance, news value',
            '**Audience Mapping**: Breadth of relevance and appeal scope',
            '**Editorial Test**: "Would this be interesting in my main feed?"',
            '',

            // Special Content Traits
            '=== CONTENT TRAITS ===',
            '',
            '**Essential** - Reveals deeper systems and structures:',
            "• Power structures, macro-economic forces, political mechanisms most people don't see",
            '• Central banking shifts, geopolitical realignments, institutional/regulatory capture',
            '• NOT surface news, celebrity reactions, trending topics, or obvious narratives',
            '',
            '**Positive** - Demonstrates genuine progress:',
            '• Breakthrough solutions, constructive developments with tangible improvement',
            '• Scientific breakthroughs, successful policies, working community solutions',
            '• NOT superficial feel-good stories or forced optimism',
            '',

            // Output Requirements
            '=== OUTPUT REQUIREMENTS ===',
            '',
            '• **classification** → Exactly one of: GENERAL | NICHE | OFF_TOPIC',
            '• **reason** → One clear, concise sentence explaining the decision',
            '• **traits** → Boolean flags for app filtering modes (essential, positive)',
            '',

            // Quality Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Clear Rationale**: Reason must reference audience scope or content nature',
            '• **Strict Filtering**: Horoscopes, astrology, pseudoscience → always OFF_TOPIC',
            '• **Trait Precision**: Set flags to true only when content serves the specific app mode purpose',
            '• **Independent Assessment**: Keep classification separate from trait evaluation',
            '',

            // Data Input
            '=== REPORT TO ANALYZE ===',
            '',
            JSON.stringify(reportData, null, 2),
        );
    };

    async run(input: ReportClassificationInput): Promise<null | ReportClassificationResult> {
        try {
            this.logger.info('Classifying report', {
                reportId: input.report.id,
            });

            const result = await this.agent.run(ReportClassificationAgent.USER_PROMPT(input));

            if (!result) {
                this.logger.warn('Classification agent returned no result', {
                    reportId: input.report.id,
                });
                return null;
            }

            this.logger.info('Report classified successfully', {
                classification: result.classification,
                reason: result.reason,
                reportId: input.report.id,
                traits: result.traits,
            });

            return {
                classification: new ClassificationVO(result.classification),
                reason: result.reason,
                traits: new ArticleTraits(result.traits),
            };
        } catch (error) {
            this.logger.error('Error during report classification', {
                error,
                reportId: input.report.id,
            });
            return null;
        }
    }
}
