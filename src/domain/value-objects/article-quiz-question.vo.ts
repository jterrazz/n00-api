import { z } from 'zod/v4';

const articleQuizQuestionSchema = z.object({
    answers: z
        .array(z.string().min(1).max(200))
        .min(2)
        .max(6)
        .describe('Array of possible answers'),
    correctAnswerIndex: z
        .number()
        .int()
        .min(0)
        .describe('Index (0-based) of the correct answer in the answers array'),
    question: z.string().min(10).max(500).describe('The quiz question text'),
});

export type ArticleQuizQuestionProps = z.infer<typeof articleQuizQuestionSchema>;

export class ArticleQuizQuestion {
    public readonly answers: string[];
    public readonly correctAnswerIndex: number;
    public readonly question: string;

    constructor(props: ArticleQuizQuestionProps) {
        const result = articleQuizQuestionSchema.safeParse(props);

        if (!result.success) {
            throw new Error(`Invalid ArticleQuizQuestion: ${result.error.message}`);
        }

        // Validate that correctAnswerIndex is within bounds
        if (props.correctAnswerIndex >= props.answers.length) {
            throw new Error(
                `correctAnswerIndex (${props.correctAnswerIndex}) must be less than answers length (${props.answers.length})`,
            );
        }

        this.question = result.data.question;
        this.answers = result.data.answers;
        this.correctAnswerIndex = result.data.correctAnswerIndex;
    }

    /**
     * Gets the correct answer text
     */
    public getCorrectAnswer(): string {
        return this.answers[this.correctAnswerIndex];
    }

    /**
     * Checks if the given answer index is correct
     */
    public isCorrectAnswer(answerIndex: number): boolean {
        return answerIndex === this.correctAnswerIndex;
    }

    /**
     * Returns a new ArticleQuizQuestion with shuffled answers
     * and updated correctAnswerIndex to match the new position
     */
    public withShuffledAnswers(): ArticleQuizQuestion {
        const correctAnswer = this.getCorrectAnswer();
        const shuffledAnswers = [...this.answers].sort(() => Math.random() - 0.5);
        const newCorrectIndex = shuffledAnswers.indexOf(correctAnswer);

        return new ArticleQuizQuestion({
            answers: shuffledAnswers,
            correctAnswerIndex: newCorrectIndex,
            question: this.question,
        });
    }
}
