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
    type ArticleQuizGenerationAgentPort,
    type ArticleQuizGenerationInput,
    type ArticleQuizGenerationResult,
} from '../../../application/ports/outbound/agents/article-quiz-generation.agent.js';

export class ArticleQuizGenerationAgentAdapter implements ArticleQuizGenerationAgentPort {
    static readonly SCHEMA = z.object({
        questions: z.array(
            z.object({
                answers: z.array(z.string()).length(4),
                correctAnswerIndex: z.number().int().min(0).max(3),
                question: z.string().min(10),
            }),
        ),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are an expert quiz generator that creates engaging, educational questions based on news articles. Your goal is to help readers test their comprehension and engagement with the content.',
        'Create 2-4 multiple choice questions per article that test understanding of key facts, implications, and context. You may include questions based on useful generic context or widely-known facts, but you must ALWAYS be 100% certain of the correct answer - never guess or hallucinate. Include a mix of factual recall and analytical thinking questions. Always provide exactly 4 short, concise answer options that will fit in small UI elements. Make incorrect answers plausible but clearly wrong to someone who read carefully.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
    );

    public readonly name = 'ArticleQuizGenerationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof ArticleQuizGenerationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: ArticleQuizGenerationAgentAdapter.SCHEMA,
            systemPrompt: ArticleQuizGenerationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: ArticleQuizGenerationInput) => {
        const framesContent =
            input.frames && input.frames.length > 0
                ? input.frames
                      .map((frame) => `\n\n${frame.headline.toString()}\n${frame.body.toString()}`)
                      .join('')
                : '';

        return new UserPromptAdapter(
            `Create quiz questions for this article.

TARGET LANGUAGE: ${input.targetLanguage.toString()}

ARTICLE HEADLINE: ${input.articleHeadline}

ARTICLE CONTENT:
${input.articleBody}${framesContent}

Generate 2-4 comprehensive quiz questions that test understanding of this article's key information and implications.

GUIDELINES:
- Questions should test understanding of key facts, implications, and context from the main article and any alternative frames/perspectives provided
- Include a mix of factual recall and analytical thinking questions
- You may create questions that compare or contrast different frames/perspectives if provided
- Make incorrect answers plausible but clearly wrong to someone who read carefully
- You may include questions based on useful generic context or widely-known facts ONLY if you are 100% certain of the correct answer
- NEVER guess, speculate, or hallucinate - only ask questions where you know the answer with absolute certainty
- Write questions in the target language specified
- Ensure questions are appropriate for a general audience
- Keep all answer options SHORT and CONCISE (max 6-8 words each) as they will be displayed in small UI elements

QUESTION TYPES TO INCLUDE:
- Key facts and details mentioned in the article
- Main themes or implications discussed
- Cause and effect relationships
- Comparisons or contrasts mentioned
- Differences between alternative frames/perspectives when provided
- Widely-known background context relevant to the topic (only if you're 100% certain)
- Basic factual knowledge that enhances understanding (only if you're absolutely sure)

Return a JSON object with a "questions" array. Each question should have:
- "question": The question text
- "answers": Array of EXACTLY 4 short, concise answer options
- "correctAnswerIndex": Index (0-based) of the correct answer

CRITICAL: Only include questions where you are absolutely certain of the correct answer. If you have ANY doubt about a fact or answer, do not include that question.`,
        );
    };

    public async run(
        input: ArticleQuizGenerationInput,
    ): Promise<ArticleQuizGenerationResult | null> {
        try {
            const result = await this.agent.run(
                ArticleQuizGenerationAgentAdapter.USER_PROMPT(input),
            );

            if (!result) {
                this.logger.warn('Quiz generation failed', {
                    agent: 'ArticleQuizGenerationAgent',
                });
                return null;
            }

            // Validate that correctAnswerIndex is within bounds for each question
            const validatedQuestions = result.questions.filter((q) => {
                if (q.correctAnswerIndex >= q.answers.length) {
                    this.logger.warn('Invalid quiz question: correctAnswerIndex out of bounds', {
                        answersLength: q.answers.length,
                        correctAnswerIndex: q.correctAnswerIndex,
                        question: q.question.substring(0, 50),
                    });
                    return false;
                }
                return true;
            });

            if (validatedQuestions.length === 0) {
                this.logger.warn('No valid quiz questions generated', {
                    agent: 'ArticleQuizGenerationAgent',
                    originalCount: result.questions.length,
                });
                return null;
            }

            return {
                questions: validatedQuestions,
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
