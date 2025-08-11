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
    type ArticleQuizGenerationAgentPort,
    type ArticleQuizGenerationInput,
    type ArticleQuizGenerationResult,
} from '../../../application/ports/outbound/agents/article-quiz-generation.agent.js';

export class ArticleQuizGenerationAgent implements ArticleQuizGenerationAgentPort {
    static readonly SCHEMA = z.object({
        questions: z.array(
            z.object({
                answers: z.array(z.string()).length(4),
                question: z.string(),
            }),
        ),
    });

    static readonly SYSTEM_PROMPT = new SystemPrompt();

    public readonly name = 'ArticleQuizGenerationAgent';

    private readonly agent: ChatAgent<z.infer<typeof ArticleQuizGenerationAgent.SCHEMA>>;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new ChatAgent(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleQuizGenerationAgent.SCHEMA,
            systemPrompt: ArticleQuizGenerationAgent.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleQuizGenerationInput) => {
        const framesContent =
            input.frames && input.frames.length > 0
                ? input.frames
                      .map((frame) => `\n\n${frame.headline.toString()}\n${frame.body.toString()}`)
                      .join('')
                : '';

        return new UserPrompt(
            // Role & Mission
            'You are an expert quiz generator creating engaging, educational questions based on news articles. Your goal: help readers test their comprehension and engagement with content.',
            '',
            'Create 2-4 multiple choice questions that test understanding of key facts, implications, and context. Must be 100% certain of correct answers—never guess or hallucinate.',
            '',
            `CRITICAL: All questions and answers MUST be written in ${input.targetLanguage.toString().toUpperCase()}.`,
            '',

            // Language & Style Requirements
            PROMPTS.FOUNDATIONS.CONTEXTUAL_ONLY,
            '',
            '**Enhanced Context Usage**: You may incorporate well-established historical facts, widely-known events, basic geographic/scientific knowledge, or common contextual information to create more educational questions—BUT ONLY when you are absolutely certain of the accuracy. Examples: historical dates of major events, basic scientific principles, well-documented political processes, established economic concepts. Never guess or approximate.',
            '',

            // Question Strategy
            '=== QUESTION STRATEGY ===',
            '',
            '**Content Focus**: Test understanding from main article and any frames/perspectives',
            '- Include mix of factual recall and analytical thinking',
            '- Compare or contrast different frames when multiple perspectives provided',
            '- Focus on key information and implications',
            '',
            '**Question Types**:',
            '- Key facts and details mentioned in article',
            '- Main themes or implications discussed',
            '- Cause and effect relationships',
            '- Comparisons or contrasts mentioned',
            '- Differences between alternative frames/perspectives',
            '- Historical context relevant to the topic (only well-established facts)',
            '- Basic scientific, geographic, or economic principles that enhance understanding',
            '- Widely-documented events or processes that provide context',
            '',

            // Answer Design
            '=== ANSWER DESIGN ===',
            '',
            '**Answer Options**: Exactly 4 short, concise options per question',
            '- Maximum 2-5 words each (for small UI elements)',
            '- ALWAYS place the correct answer as the FIRST option (index 0)',
            '- Make remaining 3 incorrect answers plausible but clearly wrong to careful readers',
            '- Ensure correct answer is unambiguous',
            '',
            '**Certainty Requirement**: Only include questions with absolute answer certainty',
            '- No guessing, speculation, or hallucination',
            '- External knowledge allowed ONLY for well-established, widely-documented facts',
            '- Historical events, basic science, geography: use only if universally accepted',
            '- If ANY doubt exists about accuracy, exclude the question',
            '',

            // Output Requirements
            '=== OUTPUT REQUIREMENTS ===',
            '',
            '• **questions** → Array of 2-4 quiz questions',
            '    • Each question contains:',
            '      • question: The question text',
            '      • answers: Array of exactly 4 answer options (correct answer ALWAYS first)',
            '',

            // Critical Standards
            '=== CRITICAL STANDARDS ===',
            '',
            '• **Answer Certainty**: 100% certain of correct answer or exclude question',
            '• **Appropriate Content**: Suitable for general audience',
            '• **UI Constraints**: Keep answer options short and concise',
            '• **Language Consistency**: All content in specified target language',
            '',

            // Article Content
            '=== ARTICLE CONTENT ===',
            '',
            `**Headline**: ${input.articleHeadline}`,
            '',
            `**Main Article**:`,
            input.articleBody,
            '',
            ...(framesContent ? ['**Alternative Frames/Perspectives**:', framesContent, ''] : []),
        );
    };

    public async run(
        input: ArticleQuizGenerationInput,
    ): Promise<ArticleQuizGenerationResult | null> {
        try {
            const result = await this.agent.run(ArticleQuizGenerationAgent.USER_PROMPT(input));

            if (!result) {
                this.logger.warn('Quiz generation failed', {
                    agent: 'ArticleQuizGenerationAgent',
                });
                return null;
            }

            // Add correct answer index (always 0 initially) and randomize order
            const processedQuestions = result.questions.map((q) => {
                // Shuffle answers while tracking correct answer position
                const correctAnswer = q.answers[0];
                const shuffledAnswers = [...q.answers].sort(() => Math.random() - 0.5);
                const correctAnswerIndex = shuffledAnswers.indexOf(correctAnswer);

                return {
                    answers: shuffledAnswers,
                    correctAnswerIndex,
                    question: q.question,
                };
            });

            if (processedQuestions.length === 0) {
                this.logger.warn('No quiz questions generated', {
                    agent: 'ArticleQuizGenerationAgent',
                });
                return null;
            }

            return {
                questions: processedQuestions,
            };
        } catch (error) {
            this.logger.error('Quiz generation error', {
                agent: 'ArticleQuizGenerationAgent',
                error,
            });
            return null;
        }
    }
}
