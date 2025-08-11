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

import { factsSchema } from '../../../domain/entities/report.entity.js';
import { Categories, categoriesSchema } from '../../../domain/value-objects/categories.vo.js';
import { angleCorpusSchema } from '../../../domain/value-objects/report-angle/angle-corpus.vo.js';

export class ReportIngestionAgent implements ReportIngestionAgentPort {
    static readonly SCHEMA = z.object({
        angles: z.array(
            z.object({
                corpus: angleCorpusSchema,
            }),
        ),
        categories: categoriesSchema,
        facts: factsSchema,
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
            'You are a senior news analyst creating structured intelligence reports. Your task: transform multiple news articles covering the SAME event into a precise data extraction with verified facts and distinct viewpoints.',
            '',
            'Extract ONLY information present in the provided articles—no external knowledge, speculation, or interpretation. Exclude meta-information about sources, journalists, or publications',
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
            '1. **facts** → Comprehensive statement of verified events',
            '   - Include ALL undisputed information confirmed across sources',
            '   - Provide complete context necessary to understand the full situation',
            '   - Information-dense but thorough coverage of all details',
            '',
            '2. **categories** → Array of relevant topic classifications',
            '   - Select applicable categories from available options',
            '',
            '3. **angles** → Array of distinct viewpoints',
            '   - Each angle represents a genuinely different perspective on the event',
            '   - For each angle provide:',
            '     • **corpus** → Complete compilation of ALL arguments, evidence, and details for this viewpoint',
            '       - NOT a summary—include every supporting detail mentioned',
            '       - Focus exclusively on the news event itself',
            '',

            // Analysis Process (How to Extract)
            '=== ANALYSIS PROCESS ===',
            '',
            '**Step 1: Extract Core Facts**',
            '- Identify information confirmed by multiple sources',
            '- Include specific numbers, dates, names, and outcomes',
            '- Exclude opinions, speculation, or single-source claims',
            '',
            '**Step 2: Identify Genuine Angles**',
            '- Look for perspectives that fundamentally disagree OR emphasize different aspects',
            '- Merge viewpoints that share the same core position (ignore superficial wording differences)',
            '- Select only the most substantial, clearly differentiated angles',
            '- If articles are largely identical, return 0 angles',
            '',
            '**Step 3: Compile Angle Corpus**',
            '- For each selected angle, gather ALL supporting evidence from across articles',
            '- Include quotes, specific claims, reasoning, and context',
            "- Maintain the angle's authentic voice and argumentation",
            '',

            // Quality Standards & Edge Cases
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Source Fidelity**: Use only information explicitly stated in provided articles',
            '• **Angle Threshold**: Only create angles for genuinely distinct viewpoints—if unsure, err toward fewer angles',
            '• **Corpus Completeness**: Each corpus must be comprehensive, not selective—include every relevant detail',
            '• **Subject Focus**: Analyze the news event itself, never the media coverage or journalism',
            '• **Quality Over Quantity**: Better to have 0-1 well-defined angles than 2 weak or similar ones',
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
                corpus: angleData.corpus,
            }));

            const ingestionResult: ReportIngestionResult = {
                angles,
                categories,
                facts: result.facts,
            };

            this.logger.info(
                `Report ingested: ${ingestionResult.facts.substring(0, 100)}... with ${ingestionResult.angles.length} angles`,
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
