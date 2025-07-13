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
    // New reusable prompt template containing detailed instructions and real-world examples.
    static readonly BASE_PROMPT_PARTS: readonly string[] = [
        // Core Mission
        'Perform a deep semantic comparison to decide whether the incoming report describes the SAME underlying event—who did what, where, and when—as any report already stored. This must go beyond surface-level keyword matching. Keep in mind we ingest raw internet sources that commonly report on the *same* events from slightly different angles.',
        '',
        // Decision Framework
        'DECISION FRAMEWORK:',
        '1. Identify ACTORS (people, organisations), ACTION (what happened), LOCATION (where), and TIMEFRAME (when) for the NEW report.',
        '2. Do the same for EACH EXISTING report.',
        "3. If MOST essential elements (actors + action + either location OR timeframe) align for ANY existing report, classify the new report as a duplicate of that report's id.",
        '4. If the overlap is weak (e.g., only one element matches) or conflicting details dominate, classify the new report as unique.',
        '',
        // Normalisation Tips
        'NORMALISATION TIPS:',
        '• Ignore minor wording differences, synonyms, or grammatical variations.',
        '• Normalise dates ("July 13th" ↔ "13 July 2025") and times ("9 AM" ↔ "09:00").',
        '• Convert accents/diacritics ("Corsica" ≅ "Corse").',
        '• Treat equivalent units ("over 100 km/h" ≅ ">100 km/h").',
        '',
        // Real-world Examples
        'EXAMPLES:',
        '• DUPLICATE — New: "Météo-France issued an orange alert for Corsica on Sunday, July 13th, from 9 AM to 12 PM, anticipating "brief but active" thunderstorms with gusts potentially exceeding 100 km/h." Existing: "Météo-France issued an orange alert for Corsica on Sunday, July 13, 2025, forecasting a brief but active thunderstorm episode between 9 AM and 12 PM with gusts over 100 km/h."',
        '• DUPLICATE — New: "Torrential rains in Catalonia, Spain, on Saturday evening caused localised flooding. Two people are missing in Cubelles." Existing: "Torrential rains battered Catalonia, Spain, on Saturday evening, causing floods and infrastructure disruption. Two people are missing near Cubelles."',
        '• UNIQUE   — New: "Star player from Team A injures knee during practice." Existing: "Team A beats Team B 3-1 in championship final."',
        '',
        // Safety Rule
        '**SAFETY RULE:** When there is substantial overlap but minor discrepancies, lean toward marking as DUPLICATE. Only mark as UNIQUE when clearly describing a distinct event.',
        '',
        // Output Requirements
        'OUTPUT REQUIREMENTS:',
        '• duplicateOfReportId → id of existing duplicate OR null.',
        '• reason → one concise sentence explaining the decision.',
        '',
    ];

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
            ...ReportDeduplicationAgentAdapter.BASE_PROMPT_PARTS,
            // Data to Analyse
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
            this.logger.info('Checking if the incoming report is a duplicate', {
                headline: params.newReport.articles[0]?.headline,
            });

            const result = await this.agent.run(
                ReportDeduplicationAgentAdapter.USER_PROMPT(params),
            );

            if (!result) {
                this.logger.warn('Deduplication check failed: AI model returned no result', {
                    headline: params.newReport.articles[0]?.headline,
                });
                return null;
            }

            this.logger.info('Deduplication check complete', {
                duplicateOfReportId: result.duplicateOfReportId,
                headline: params.newReport.articles[0]?.headline,
                reason: result.reason,
            });

            return {
                duplicateOfReportId: result.duplicateOfReportId,
            };
        } catch (error) {
            this.logger.error('Error during deduplication check', {
                error,
                headline: params.newReport.articles[0]?.headline,
            });
            return null;
        }
    }
}
