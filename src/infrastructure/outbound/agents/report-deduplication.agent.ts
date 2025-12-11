import { createSchemaPrompt, parseObject } from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import type { LanguageModel } from 'ai';
import { generateText } from 'ai';
import { z } from 'zod/v4';

// Application
import {
    type ReportDeduplicationAgentPort,
    type ReportDeduplicationResult,
} from '../../../application/ports/outbound/agents/report-deduplication.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

export class ReportDeduplicationAgent implements ReportDeduplicationAgentPort {
    static readonly SCHEMA = z.object({
        duplicateOfReportId: z.string().nullable(),
        reason: z.string(),
    });

    public readonly name = 'ReportDeduplicationAgent';

    constructor(
        private readonly model: LanguageModel,
        private readonly logger: LoggerPort,
    ) {}

    static readonly USER_PROMPT = (input: {
        existingReports: Array<{ background: string; core: string; id: string }>;
        newReport: NewsReport;
    }): string => {
        const { existingReports, newReport } = input;

        return [
            // Core Mission
            'Determine whether an incoming news report describes the same underlying event as any existing report in our database. Focus on the core event, not surface-level similarities.',
            '',

            // Language & Style Requirements
            'Base your response solely on the information provided. Do not infer, assume, or add external knowledge.',
            '',

            // Smart Analysis Process
            '=== ANALYSIS PROCESS ===',
            '',
            '**1. Event Decomposition**',
            '• Extract core elements: WHO, WHAT, WHERE, WHEN from new report',
            '• Identify the fundamental event being described',
            '',
            '**2. Comparison Logic**',
            '• Apply same decomposition to each existing report',
            '• Look for substantial overlap in essential event details',
            '• Essential elements align → DUPLICATE | Weak overlap → UNIQUE',
            '',

            // Smart Normalization
            '=== SMART MATCHING ===',
            '',
            '• **Ignore Variations**: Wording differences, synonyms, format differences',
            '• **Normalize Time/Date**: "July 13th" = "13 July 2025", "9 AM" = "09:00"',
            '• **Geographic Flexibility**: Handle accents ("Corsica" ≅ "Corse")',
            '• **Number Equivalence**: "over 100 km/h" ≅ ">100 km/h"',
            '',

            // Clear Examples
            '=== DECISION PATTERNS ===',
            '',
            '**DUPLICATE** - Same core event:',
            '• Weather alerts for same region, date, and phenomenon',
            '• Natural disasters affecting same area and timeframe',
            '• Policy announcements from same source on same topic',
            '',
            '**UNIQUE** - Different events:',
            '• Different events involving same entities (injury vs. game result)',
            '• Sequential developments in ongoing situations',
            '• Related but distinct incidents (different locations/times)',
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
        ].join('\n');
    };

    async run(params: {
        existingReports: Array<{ background: string; core: string; id: string }>;
        newReport: NewsReport;
    }): Promise<null | ReportDeduplicationResult> {
        try {
            this.logger.info('Checking if the incoming report is a duplicate', {
                headline: params.newReport.articles[0]?.headline,
            });

            const { text } = await generateText({
                model: this.model,
                prompt: ReportDeduplicationAgent.USER_PROMPT(params),
                system: createSchemaPrompt(ReportDeduplicationAgent.SCHEMA),
            });

            const result = parseObject(text, ReportDeduplicationAgent.SCHEMA);

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
