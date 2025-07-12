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
        'You are an expert Senior Editor for a modern digital news platform. Your primary responsibility is to classify stories to ensure quality, relevance, and proper placement within the app.',
        'You are discerning, have high standards, and understand what makes a report compelling for a broad audience versus a niche one.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.TONES.NEUTRAL,
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
            'You are a Senior Editor. Your role is to determine if a report has broad, general appeal, is suited for a niche audience, or should be archived entirely. Trust your editorial judgment to ensure our main feed is engaging for everyone, while still serving dedicated fans and filtering out irrelevant content.',
            '',

            // The Classifications - Your Guiding Principles
            'Use these principles to guide your decision:',
            '•   **STANDARD:** For reports with broad, mainstream appeal. This is for content that a general audience would find interesting or important. **Example:** a major championship final, a significant political election, or major international news.',
            '•   **NICHE:** For high-quality reports that primarily serve a specific community or interest group. Use this for content that is not of broad interest. **Example:** a regular-season match between less popular teams, specific celebrity news, or updates on a niche hobby.',
            '•   **ARCHIVED:** Use this for content that is not a report on a real-world event. This includes game guides (like Wordle answers/hints), listicles, promotional content, direct advertisements, or pure opinion pieces without a factual basis.',
            '',

            // Your Task
            "Your task is to weigh the report's topic against these principles and use your editorial 'feel' to assign the most appropriate classification. The primary factor is the report's audience and where it should be placed.",
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '•   You **MUST** select one of the three classifications: `STANDARD`, `NICHE`, or `ARCHIVED`.',
            '•   You **MUST** provide a brief, clear `reason` justifying your editorial decision.',
            '',

            // Report to Analyze
            'REPORT TO ANALYZE:',
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
