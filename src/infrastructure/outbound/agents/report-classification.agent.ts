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
            // Role & Mission
            'You are a seasoned Senior Editor and content curator for a global digital news platform. Your mission: evaluate each report and classify it for optimal content strategy and audience targeting.',
            '',
            'Apply rigorous editorial judgment to distinguish broad mainstream appeal from niche-interest content, and filter out low-value material. Your classification keeps the main feed compelling for the widest audience while surfacing specialized content to appropriate readers.',
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',

            // Classification Framework
            '=== CLASSIFICATION SYSTEM ===',
            '',
            '**GENERAL** → Broad public interest with national/international relevance',
            '- Would be covered on prime-time television news broadcasts',
            '- Appeals to diverse demographics and regions',
            '',
            '**NICHE** → Relevant primarily to specific subgroups or regions',
            '- Industry-specific, hobby-focused, or demographically targeted',
            '- Limited mainstream crossover but valuable to its audience',
            '',
            '**OFF_TOPIC** → Lacks substantive news value or factual basis',
            '- Auxiliary content, lifestyle advice, entertainment without news angle',
            '- Pseudoscientific predictions, horoscopes, astrology',
            '- Promotional material, listicles, opinion without factual foundation',
            '',

            // Analysis Process
            '=== ANALYSIS PROCESS ===',
            '',
            '**Step 1: Content Assessment**',
            '- Identify core topic and primary audience',
            '- Evaluate factual substance vs. opinion/entertainment',
            '- Assess real-world news value and timeliness',
            '',
            '**Step 2: Audience Mapping**',
            '- Determine breadth of relevance (general public vs. specific groups)',
            '- Consider geographic and demographic scope',
            '- Evaluate mainstream vs. specialized appeal',
            '',
            '**Step 3: Editorial Judgment**',
            '- Ask yourself: "Would it be interesting to have this story in my main feed?"',
            "- Consider user engagement and content value from a reader's perspective",
            '- Balance editorial quality with audience interest',
            '',
            '**Step 4: Trait Evaluation**',
            "- **essential**: Content that reveals underlying power structures, macro-economic forces, or deep political mechanisms that most people don't expect to encounter. NOT typical media noise, reactions, or diversions. Think: central banking policy shifts, geopolitical power realignments, institutional capture, regulatory capture, systemic financial risks. Set to FALSE for surface-level news, celebrity reactions, trending topics, or obvious mainstream narratives.",
            "- **positive**: Content showcasing genuine progress, breakthrough solutions, or constructive developments that demonstrate tangible improvement in the world. NOT superficial feel-good stories or forced optimism. Think: scientific breakthroughs, successful policy implementations, community solutions that work, technological advances solving real problems, social progress with measurable impact. Counters the media's negativity bias with substantive positive reality.",
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
