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
    type ReportIngestionAgentPort,
    type ReportIngestionResult,
} from '../../../application/ports/outbound/agents/report-ingestion.agent.js';
import { type NewsReport } from '../../../application/ports/outbound/providers/news.port.js';

import { Categories, categoriesSchema } from '../../../domain/value-objects/categories.vo.js';
import { backgroundSchema } from '../../../domain/value-objects/report/background.vo.js';
import { coreSchema } from '../../../domain/value-objects/report/core.vo.js';
import { angleNarrativeSchema } from '../../../domain/value-objects/report-angle/angle-narrative.vo.js';

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
            // Role & Mission
            'You are a senior news analyst creating COMPREHENSIVE intelligence reports. Your mission: transform multiple news articles covering the SAME event into an EXHAUSTIVE data extraction with ALL verified facts and distinct viewpoints.',
            '',
            'CRITICAL INSTRUCTION: You must be MAXIMALLY VERBOSE and COMPREHENSIVE. Extract EVERY SINGLE piece of information present in the provided articles—no external knowledge, speculation, or interpretation. This is a complete information preservation task, not a summary.',
            '',
            'VERBOSITY REQUIREMENT: Capture ALL details, quotes, statistics, names, dates, locations, and contextual information. If information exists in the articles, it MUST be included in your output. Nothing should be condensed, summarized, or omitted.',
            '',
            'NOTE: Articles are parsed from online sources and may occasionally contain web page metadata or parsing artifacts. Focus solely on the actual news content and ignore any irrelevant web page elements.',
            '',

            // Language & Style Requirements
            PROMPTS.LANGUAGES.ENGLISH_NATIVE,
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            PROMPTS.TONES.NEUTRAL,
            PROMPTS.VERBOSITY.DETAILED,
            '',

            // Output Structure (What to Extract)
            '=== OUTPUT REQUIREMENTS ===',
            '',
            'CRITICAL: BE EXTREMELY VERBOSE AND COMPREHENSIVE. CAPTURE EVERY SINGLE DETAIL, FACT, QUOTE, STATISTIC, NAME, DATE, LOCATION, AND PIECE OF INFORMATION FROM ALL ARTICLES. NOTHING SHOULD BE OMITTED OR SUMMARIZED.',
            '',
            '1. **core** → The main story being reported (EXHAUSTIVELY DETAILED)',
            '   - What is this story fundamentally about? Include EVERY fact, detail, and development',
            '   - Capture ALL primary subjects, main developments, central narrative elements',
            '   - Include ALL specific details: names, dates, locations, numbers, quotes, actions',
            '   - List EVERY event, decision, announcement, or development mentioned',
            '   - DO NOT exclude any detail that relates to the main story',
            '   - BE VERBOSE: Write everything in extensive detail, not summaries',
            '',
            '2. **background** → Supporting contextual information (COMPLETE COMPILATION)',
            '   - Capture ALL historical context, previous events, timeline details',
            '   - Include EVERY mention of key players, their roles, backgrounds, relationships',
            '   - Record ALL industry context, market conditions, regulatory environment',
            '   - Document EVERY previous development, precedent, related incident',
            '   - Include ALL relevant context that helps understand the core story',
            '   - Capture EVERY detail about organizations, companies, institutions involved',
            '   - BE EXHAUSTIVE: Include every contextual detail mentioned across all articles',
            '',
            '3. **categories** → Array of relevant topic classifications',
            '   - Select applicable categories from available options',
            '',
            '4. **angles** → Array of distinct viewpoints on the core story',
            '   - Each angle represents a genuinely different perspective',
            '   - For each angle provide:',
            '     • **narrative** → COMPLETE and EXHAUSTIVE account from this perspective',
            '       - EVERY single argument, claim, position, and reasoning',
            '       - ALL supporting evidence, data, statistics, examples cited',
            '       - EVERY quote, statement, declaration from sources',
            '       - ALL counterarguments, rebuttals, responses mentioned',
            '       - EVERY detail about methodology, process, timeline from this angle',
            '       - ALL implications, consequences, outcomes discussed',
            '       - EVERY expert opinion, analysis, interpretation provided',
            '       - ALL emotional language, emphasis, tone indicators',
            '       - BE MAXIMALLY VERBOSE: This is a raw information dump, not a summary',
            '       - CAPTURE EVERYTHING: If mentioned in articles, it goes in the narrative',
            '',

            // Analysis Process (How to Extract)
            '=== ANALYSIS PROCESS ===',
            '',
            '**Step 1: Extract Core Story with MAXIMUM DETAIL**',
            '- What is the main subject or development being reported? INCLUDE EVERYTHING',
            '- Extract ALL primary narrative elements with complete specificity',
            '- Capture EVERY name, date, location, number, quote, and action mentioned',
            '- List EVERY event, decision, announcement, or development in full detail',
            '- Include ALL direct quotes, paraphrased statements, and official communications',
            '- Document EVERY timeline element, sequence, and chronological detail',
            '- VERBOSE REQUIREMENT: Write everything extensively, never summarize',
            '',
            '**Step 2: Compile ALL Background Context**',
            '- Identify and capture EVERY piece of supporting contextual information',
            '- Extract ALL historical context, precedents, and previous related events',
            '- Document EVERY detail about key players: roles, backgrounds, relationships, history',
            '- Include ALL industry context, market conditions, regulatory details',
            '- Capture EVERY organizational detail, company information, institutional context',
            '- Record ALL broader situational factors, environmental conditions, external influences',
            '- COMPREHENSIVE REQUIREMENT: If it provides context, include it in full detail',
            '',
            '**Step 3: Identify Genuine Angles with COMPLETE SEPARATION**',
            '- Look for perspectives that fundamentally disagree OR emphasize different aspects',
            '- Merge viewpoints that share the same core position (ignore superficial wording differences)',
            '- Select only the most substantial, clearly differentiated angles',
            '- If articles are largely identical, return 0 angles',
            '- ENSURE each angle captures a genuinely distinct interpretation or emphasis',
            '',
            '**Step 4: Compile EXHAUSTIVE Angle Narratives**',
            '- For each selected angle, gather EVERY SINGLE supporting detail from across ALL articles',
            '- Include EVERY quote, claim, argument, reasoning, and piece of evidence',
            '- Capture ALL statistical data, research findings, expert opinions',
            '- Document EVERY counterargument, rebuttal, criticism, and response',
            '- Include ALL methodology details, process descriptions, and procedural information',
            '- Record EVERY implication, consequence, prediction, and outcome discussed',
            '- Preserve ALL emotional language, emphasis markers, and tone indicators',
            "- Maintain the angle's authentic voice while being maximally comprehensive",
            '- CRITICAL: This is a complete information dump, not a narrative summary',
            '',

            // Quality Standards & Edge Cases
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Source Fidelity**: Use ONLY information explicitly stated in provided articles - capture ALL of it',
            '• **Maximum Verbosity**: Be extremely detailed and comprehensive - never summarize or condense',
            '• **Complete Extraction**: Include EVERY fact, quote, statistic, name, date, location mentioned',
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
