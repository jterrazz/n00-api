import { ArticleQuizQuestion, type ArticleQuizQuestionProps } from './article-quiz-question.vo.js';

export class ArticleQuizQuestions {
    public readonly values: ArticleQuizQuestion[];

    constructor(questions: (ArticleQuizQuestion | ArticleQuizQuestionProps)[]) {
        this.values = questions.map((question) => {
            return question instanceof ArticleQuizQuestion
                ? question
                : new ArticleQuizQuestion(question);
        });
    }

    /**
     * Creates an empty collection
     */
    public static empty(): ArticleQuizQuestions {
        return new ArticleQuizQuestions([]);
    }

    /**
     * Returns the number of quiz questions
     */
    public count(): number {
        return this.values.length;
    }

    /**
     * Gets a specific question by index
     */
    public getQuestion(index: number): ArticleQuizQuestion | undefined {
        return this.values[index];
    }

    /**
     * Checks if there are any quiz questions
     */
    public isEmpty(): boolean {
        return this.values.length === 0;
    }

    /**
     * Returns all questions as an array
     */
    public toArray(): ArticleQuizQuestion[] {
        return [...this.values];
    }

    /**
     * Adds a new question to the collection
     */
    public withQuestion(
        question: ArticleQuizQuestion | ArticleQuizQuestionProps,
    ): ArticleQuizQuestions {
        const newQuestion =
            question instanceof ArticleQuizQuestion ? question : new ArticleQuizQuestion(question);

        return new ArticleQuizQuestions([...this.values, newQuestion]);
    }

    /**
     * Returns questions with shuffled answers for each question
     */
    public withShuffledAnswers(): ArticleQuizQuestions {
        const shuffledQuestions = this.values.map((question) => question.withShuffledAnswers());
        return new ArticleQuizQuestions(shuffledQuestions);
    }
}
