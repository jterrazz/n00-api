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
    classificationSchema,
    type ReportClassificationAgentPort,
    type ReportClassificationInput,
    type ReportClassificationResult,
} from '../../../application/ports/outbound/agents/report-classification.agent.js';

import { Classification as ClassificationVO } from '../../../domain/value-objects/report/classification.vo.js';

export class ReportClassificationAgentAdapter implements ReportClassificationAgentPort {
    static readonly SCHEMA = z.object({
        classification: classificationSchema,
        reason: z
            .string()
            .describe('A brief, clear justification for your classification selection.'),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are a seasoned Senior Editor and content curator for a global digital news platform. Your mission is to evaluate each incoming report and decide which classification best serves our readership and content strategy.',
        'Apply rigorous editorial judgment to distinguish stories with broad mainstream appeal from niche-interest pieces, and to filter out content that offers little news value. Your decision keeps the main feed compelling for the widest audience while still surfacing specialised content to the right readers.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
    );

    public readonly name = 'ReportClassificationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof ReportClassificationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ReportClassificationAgentAdapter.SCHEMA,
            systemPrompt: ReportClassificationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ReportClassificationInput) => {
        const { report } = input;
        const reportData = {
            angles: report.angles?.map((angle) => ({
                digest: angle.angleCorpus.value,
                discourse: angle.discourse.value,
                stance: angle.stance.value,
            })),
            category: report.category.toString(),
            facts: report.facts,
        };

        return new UserPromptAdapter(
            // Core Mission
            'You are the Senior Editor of a global digital newsroom. Decide whether the following report belongs in the MAIN feed (STANDARD), in a specialised vertical (NICHE), or should be excluded (ARCHIVED). Your judgment balances audience breadth, relevance, and editorial quality.',
            '',

            // Classification Guidelines
            'CLASSIFICATION GUIDELINES:',
            '• STANDARD → Broad mainstream appeal; most readers would find it timely and important (e.g. championship finals, national elections, major policy changes).',
            '• NICHE → Valuable to a specific community or hobby but limited mainstream interest (e.g. minor league updates, niche tech releases, specialised hobby news).',
            '• ARCHIVED → Lacks real-world news value or is purely auxiliary content (e.g. game guides, listicles, promotions, opinion pieces without factual basis).',
            '',

            // Analysis Framework
            'ANALYSIS FRAMEWORK:',
            '1. Identify the core topic and target audience.',
            '2. Assess its breadth of relevance and timeliness.',
            '3. Map the report to one classification using the guidelines above.',
            '',

            // Output Requirements
            'OUTPUT REQUIREMENTS:',
            '• classification → One of: STANDARD | NICHE | ARCHIVED.',
            '• reason → One concise sentence explaining the decision.',
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '• You MUST choose exactly one classification.',
            '• You MUST provide a reason that is clear, brief, and references the audience or content nature.',
            '',

            // Report to Analyse
            'REPORT TO ANALYSE:',
            JSON.stringify(reportData, null, 2),
        );
    };

    async run(input: ReportClassificationInput): Promise<null | ReportClassificationResult> {
        try {
            this.logger.info(`[${this.name}] Classifying report...`, {
                reportId: input.report.id,
            });

            const result = await this.agent.run(
                ReportClassificationAgentAdapter.USER_PROMPT(input),
            );

            if (!result) {
                this.logger.warn(`[${this.name}] Classification failed. No result from AI model.`, {
                    reportId: input.report.id,
                });
                return null;
            }

            this.logger.info(`[${this.name}] Report classified successfully.`, {
                classification: result.classification,
                reason: result.reason,
                reportId: input.report.id,
            });

            return {
                classification: new ClassificationVO(result.classification),
                reason: result.reason,
            };
        } catch (error) {
            this.logger.error(`[${this.name}] An error occurred during classification.`, {
                error,
                reportId: input.report.id,
            });
            return null;
        }
    }
}
