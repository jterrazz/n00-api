import {
    ChatAgent,
    type ModelPort,
    PROMPTS,
    SystemPrompt,
    UserPrompt,
} from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

import {
    type ReportDeduplicationAgentPort,
    type ReportDeduplicationResult,
} from '../../../application/ports/outbound/agents/report-deduplication.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

export class ReportDeduplicationAgentAdapter implements ReportDeduplicationAgentPort {
    static readonly SCHEMA = z.object({
        duplicateOfReportId: z.string().nullable(),
        reason: z.string(),
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ReportDeduplicationAgent';

    private readonly agent: ChatAgent<z.infer<typeof ReportDeduplicationAgentAdapter.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
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

        return new UserPrompt(
            // Role & Mission
            'You are a senior editorial gatekeeper for a global news organization. Your mission: determine whether an incoming news report describes the same underlying event as any existing report in our database.',
            '',
            'Perform deep comparison beyond surface-level keywords. Focus on core event.',
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',

            // Analysis Framework
            '=== ANALYSIS FRAMEWORK ===',
            '',
            '**Step 1: Event Decomposition**',
            '- Extract every element from new report',
            '- Note LOCATION (where) and TIMEFRAME (when) from new report',
            '',
            '**Step 2: Comparative Analysis**',
            '- Apply same decomposition to each existing report',
            '- Compare essential elements across reports',
            '- Look for substantial overlap in core event details',
            '',
            '**Step 3: Duplication Decision**',
            '- If essential elements align → DUPLICATE',
            '- If weak overlap or conflicting details → UNIQUE',
            '',

            // Normalization Guidelines
            '=== NORMALIZATION GUIDELINES ===',
            '',
            '• **Language Variations**: Ignore wording differences, synonyms, grammatical variations',
            '• **Date/Time Formats**: Normalize formats ("July 13th" ↔ "13 July 2025", "9 AM" ↔ "09:00")',
            '• **Geographic Names**: Handle accents/diacritics ("Corsica" ≅ "Corse")',
            '• **Units & Numbers**: Treat equivalent expressions ("over 100 km/h" ≅ ">100 km/h")',
            '',

            // Decision Examples
            '=== DECISION EXAMPLES ===',
            '',
            '**DUPLICATE Cases:**',
            '• Weather alerts for same region, date, and phenomenon (despite wording differences)',
            '• Natural disasters affecting same area and timeframe (despite different details)',
            '',
            '**UNIQUE Cases:**',
            '• Different events involving same entities (injury vs. game result)',
            '• Sequential events in ongoing situations (different developments)',
            '• Related but distinct incidents (different locations or times)',
            '',

            // Output Requirements
            '=== OUTPUT REQUIREMENTS ===',
            '',
            '• **duplicateOfReportId** → ID of existing duplicate report OR null if unique',
            '• **reason** → One concise sentence explaining the duplication decision',
            '',

            // Critical Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Core Event Focus**: Base decision on fundamental event identity, not presentation',
            '• **Semantic Depth**: Go beyond keyword matching to understand meaning',
            '• **Conservative Approach**: When in doubt about substantial overlap, mark as duplicate',
            '• **Clear Reasoning**: Explain decision based on event element comparison',
            '',

            // Data Input
            '=== DATA TO ANALYZE ===',
            '',
            '**EXISTING REPORTS:**',
            JSON.stringify(existingReports, null, 2),
            '',
            '**NEW INCOMING REPORT:**',
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
