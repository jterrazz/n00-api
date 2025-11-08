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
    type ReportIngestionAgentPort,
    type ReportIngestionResult,
} from '../../../application/ports/outbound/agents/report-ingestion.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

// Domain
import { Categories, categoriesSchema } from '../../../domain/value-objects/categories.vo.js';
import { angleNarrativeSchema } from '../../../domain/value-objects/report-angle/angle-narrative.vo.js';
import { backgroundSchema } from '../../../domain/value-objects/report/background.vo.js';
import { coreSchema } from '../../../domain/value-objects/report/core.vo.js';

export class ReportIngestionAgent implements ReportIngestionAgentPort {
    static readonly SCHEMA = z.object({
        angles: z.array(
            z.object({
                narrative: angleNarrativeSchema,
            }),
        ),
        background: backgroundSchema,
        categories: categoriesSchema,
        core: coreSchema,
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ReportIngestionAgent';

    private readonly agent: ChatAgent<z.infer<typeof ReportIngestionAgent.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ReportIngestionAgent.SCHEMA,
            systemPrompt: ReportIngestionAgent.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (newsReport: NewsReport) =>
        new UserPrompt(
            // Core Mission
            'Transform multiple news articles covering the SAME event into a comprehensive intelligence report. Extract ALL verified facts and distinct viewpoints—complete information preservation, not summarization.',
            '',
            'Be maximally thorough: capture every detail, quote, statistic, name, date, and location. If information exists in the articles, include it. Ignore web page artifacts and focus on actual news content.',
            '',

            // Language & Style Requirements
            PROMPTS.LANGUAGES.ENGLISH_NATIVE,
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            PROMPTS.TONES.NEUTRAL,
            PROMPTS.VERBOSITY.DETAILED,
            '',

            // Extract Four Key Components
            '=== EXTRACT THESE COMPONENTS ===',
            '',
            '**1. Core Story** - The main narrative with exhaustive detail:',
            '• Primary subjects, developments, and events',
            '• All names, dates, locations, numbers, quotes, actions',
            '• Every announcement, decision, or development mentioned',
            '',
            '**2. Background Context** - Complete supporting information:',
            '• Historical context, previous events, timelines',
            '• Key players: roles, backgrounds, relationships',
            '• Industry context, market conditions, regulations',
            '• Organizational details and institutional context',
            '',
            '**3. Categories** - Select all relevant topic classifications',
            '',
            '**4. Angles** - Distinct viewpoints (only if genuinely different):',
            '• Each angle = fundamentally different perspective or emphasis',
            '• For each angle: comprehensive narrative with ALL supporting details',
            '• Include every argument, evidence, quote, and implication from that perspective',
            '• If articles are largely identical, return 0 angles',
            '',

            // Extraction Process
            '=== EXTRACTION PROCESS ===',
            '',
            '**Step 1: Core Extraction**',
            '• Identify the main story and capture every detail',
            '• Include all quotes, statements, and official communications',
            '• Document complete timeline and sequence of events',
            '',
            '**Step 2: Context Compilation**',
            '• Gather all historical context and precedents',
            '• Document key players and organizational details',
            '• Record industry/regulatory context and broader factors',
            '',
            '**Step 3: Angle Identification**',
            '• Look for perspectives that fundamentally disagree or emphasize different aspects',
            '• Merge similar viewpoints (ignore superficial wording differences)',
            '• Select only substantial, clearly differentiated angles',
            '',
            '**Step 4: Comprehensive Narratives**',
            '• For each angle: compile ALL supporting details from across articles',
            '• Include every quote, claim, evidence, and counterargument',
            '• Preserve authentic voice while being maximally thorough',
            '',

            // Quality Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Complete Fidelity**: Use ONLY information from provided articles',
            '• **Maximum Thoroughness**: Capture every detail—never summarize or condense',
            '• **Distinct Angles**: Only create angles for genuinely different perspectives',
            '• **Clear Separation**: Core story should be distinct from background context, but both must be exhaustive',
            '• **Angle Threshold**: Only create angles for genuinely distinct viewpoints—if unsure, err toward fewer angles',
            '• **Narrative Completeness**: Each narrative must capture EVERY detail, argument, and piece of evidence for that perspective',
            "• **Information Preservation**: Nothing should be lost - if it's in the articles, it must be captured somewhere",
            '• **Subject Focus**: Analyze the news story itself, never the media coverage or journalism',
            '• **Quality Over Quantity**: Better to have 0-1 well-defined angles than 2 weak or similar ones',
            '• **Exhaustive Documentation**: Treat this as creating a complete archive of all information in the articles',
            '',

            // Data Input
            '=== SOURCE ARTICLES ===',
            '',
            JSON.stringify(
                newsReport.articles.map((article) => ({
                    body: article.body,
                    headline: article.headline,
                })),
                null,
                2,
            ),
        );

    async run(params: { newsReport: NewsReport }): Promise<null | ReportIngestionResult> {
        try {
            this.logger.info(`Ingesting report with ${params.newsReport.articles.length} articles`);

            const result = await this.agent.run(
                ReportIngestionAgent.USER_PROMPT(params.newsReport),
            );

            if (!result) {
                this.logger.warn('Ingestion agent returned no result');
                return null;
            }

            // Log successful parsing for debugging
            this.logger.info(
                `AI response parsed successfully with ${result.angles.length} angles`,
                {
                    categories: result.categories,
                },
            );

            // Create value objects from AI response
            const categories = new Categories(result.categories);

            // Create angle data from AI response (without creating full ReportAngle entities)
            const angles = result.angles.map((angleData) => ({
                narrative: angleData.narrative,
            }));

            const ingestionResult: ReportIngestionResult = {
                angles,
                background: result.background,
                categories,
                core: result.core,
            };

            this.logger.info(
                `Report ingested: ${ingestionResult.core.substring(0, 100)}... with ${ingestionResult.angles.length} angles`,
            );

            return ingestionResult;
        } catch (error) {
            this.logger.error('Failed to ingest report', {
                articleCount: params.newsReport.articles.length,
                error,
            });
            return null;
        }
    }
}
