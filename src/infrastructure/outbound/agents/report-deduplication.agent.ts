import {
    BasicAgentAdapter,
    type ModelPort,
    SystemPromptAdapter,
    UserPromptAdapter,
} from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

import {
    type ReportDeduplicationAgentPort,
    type ReportDeduplicationResult,
} from '../../../application/ports/outbound/agents/report-deduplication.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

/**
 * @description
 * This is a placeholder implementation for the Report Deduplication Agent.
 * In a real application, this would connect to a language model to perform
 * semantic analysis. For now, it always returns 'not a duplicate'.
 */
export class ReportDeduplicationAgentAdapter implements ReportDeduplicationAgentPort {
    static readonly SCHEMA = z.object({
        duplicateOfReportId: z
            .string()
            .nullable()
            .describe("The ID of the existing report if it's a duplicate, otherwise null."),
        reason: z.string().describe('A brief, clear justification for your decision.'),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are a senior editorial gatekeeper for a global news organisation.',
        'Your mission is to decide whether an incoming news report describes the exact same core information as any report that already exists in our database.',
        'If two reports describe the identical event, flag the new one as a duplicate; otherwise mark it as unique. Differences in wording, headline, publisher, language, or minor details do NOT create uniqueness. When in doubt, prefer uniqueness.',
    );

    public readonly name = 'ReportDeduplicationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof ReportDeduplicationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ReportDeduplicationAgentAdapter.SCHEMA,
            systemPrompt: ReportDeduplicationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: {
        existingReports: Array<{ facts: string; id: string }>;
        newReport: NewsReport;
    }) => {
        const { existingReports, newReport } = input;

        return new UserPromptAdapter(
            // Core Mission
            'Perform a deep semantic comparison to decide whether the incoming report describes the SAME underlying event—who did what, where, and when—as any report already stored. This is far beyond surface-level keyword matching.',
            '',

            // Decision Framework
            'DECISION FRAMEWORK:',
            '1. Extract the core event from the NEW report (actors, action, location, timeframe, etc.).',
            '2. Extract the core event from EACH EXISTING report.',
            "3. If every element (actors, action, location, timeframe, etc.) matches for any existing report, classify the new report as a duplicate of that report's id.",
            '4. If no existing report matches on all elements, classify the new report as unique.',
            '',

            // Examples
            'EXAMPLES:',
            '• DUPLICATE → New: "Team A beats Team B 3-1 in the championship final." Existing: "Championship final ends with Team A\'s 3-1 victory over Team B."',
            '• UNIQUE → New: "Star player from Team A injures knee during practice." Existing: "Team A beats Team B 3-1 in championship final."',
            '',

            // Safety Rule
            '**SAFETY RULE:** If you are not absolutely certain a report is a duplicate, classify it as UNIQUE (duplicateOfReportId = null). It is better to allow a rare duplicate than to miss a new story.',
            '',

            // Output Requirements
            'OUTPUT REQUIREMENTS:',
            '• duplicateOfReportId → id of existing duplicate OR null.',
            '• reason → one concise sentence explaining the decision.',
            '',

            // Data to Analyze
            'EXISTING REPORTS (ID and Facts):',
            JSON.stringify(existingReports, null, 2),
            '',
            'NEW REPORT (Full Content):',
            JSON.stringify(newReport, null, 2),
        );
    };

    async run(params: {
        existingReports: Array<{ facts: string; id: string }>;
        newReport: NewsReport;
    }): Promise<null | ReportDeduplicationResult> {
        try {
            this.logger.info(`[${this.name}] Checking for report duplicates...`, {
                newReportTitle: params.newReport.articles[0]?.headline,
            });

            const result = await this.agent.run(
                ReportDeduplicationAgentAdapter.USER_PROMPT(params),
            );

            if (!result) {
                this.logger.warn(
                    `[${this.name}] Deduplication check failed. No result from AI model.`,
                    {
                        newReportTitle: params.newReport.articles[0]?.headline,
                    },
                );
                return null;
            }

            this.logger.info(`[${this.name}] Deduplication check complete.`, {
                duplicateOfReportId: result.duplicateOfReportId,
                newReportTitle: params.newReport.articles[0]?.headline,
                reason: result.reason,
            });

            return {
                duplicateOfReportId: result.duplicateOfReportId,
            };
        } catch (error) {
            this.logger.error(`[${this.name}] An error occurred during deduplication check.`, {
                error,
                newReportTitle: params.newReport.articles[0]?.headline,
            });
            return null;
        }
    }
}
