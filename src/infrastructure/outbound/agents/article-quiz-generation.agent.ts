import { ChatAgent, type ModelPort, SystemPrompt, UserPrompt } from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

// Application
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
        return new UserPrompt(
            // Core Mission
            'Create engaging quiz questions that make readers think and learn from this news article.',
            '',
            `Generate 2-4 multiple choice questions in ${input.targetLanguage.toString().toUpperCase()}. Focus on the most INTERESTING and thought-provoking aspects—if the content lacks compelling elements, create fewer questions (even just 1-2) rather than forcing boring ones.`,
            '',
            ...(input.traits.essential
                ? [
                      '**ESSENTIAL CONTENT ALERT**: This article is marked as "essential" - it reveals important patterns, systems, or implications that readers must understand. Your questions MUST capture the key insights that make this content essential, regardless of category.',
                      '',
                  ]
                : []),

            // Key Rules
            '=== ESSENTIAL RULES ===',
            '',
            '• **Be 100% certain** of correct answers—never guess or hallucinate',
            '• **Prioritize interest** over quantity—better few great questions than many dull ones',
            '• **Test comprehension** of key facts, implications, and context',
            '• **Use established knowledge** only when absolutely certain (major historical events, basic science, geography)',
            '• **Respect sensitive topics** - avoid trivializing deaths, tragedies, disasters, or personal suffering. Focus on broader implications, policy responses, or factual context rather than making games of human tragedy',
            '• **Essential content priority** - for articles marked as "essential", ALWAYS create questions that capture the core insights that make the content essential, regardless of category. These articles reveal important patterns, systems, or implications that readers must understand',
            '',

            // Question Focus
            '=== WHAT MAKES QUESTIONS INTERESTING ===',
            '',
            '• Key turning points or surprising facts in the story',
            '• Cause-and-effect relationships that matter',
            '• Contrasts between different perspectives/frames',
            '• Implications or consequences mentioned',
            '• Essential context that enhances understanding',
            '• Connections to well-known historical/scientific concepts',
            '',

            // Answer Format
            '=== ANSWER FORMAT ===',
            '',
            '• Exactly 4 options per question (2-5 words each)',
            '• Correct answer ALWAYS first (index 0)',
            '• Wrong answers plausible but clearly incorrect to careful readers',
            '• No numbering (1,2,3,4) or letters (A,B,C,D)—just plain text',
            '',

            // Content to Process
            '=== ARTICLE TO ANALYZE ===',
            '',
            input.articleContent,
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
