import { type LoggerPort } from '@jterrazz/logger';

// Domain
import { Article } from '../../../domain/entities/article.entity.js';
import { ArticleQuizQuestion } from '../../../domain/value-objects/article-quiz-question.vo.js';
import { ArticleQuizQuestions } from '../../../domain/value-objects/article-quiz-questions.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

// Ports
import { type ArticleQuizGenerationAgentPort } from '../../ports/outbound/agents/article-quiz-generation.agent.js';
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article/article-repository.port.js';

/**
 * Use case for generating quiz questions/challenges for articles that don't have them yet
 * @description Creates quiz questions for articles to enhance user engagement
 */
export class GenerateArticleChallengesUseCase {
    constructor(
        private readonly articleRepository: ArticleRepositoryPort,
        private readonly articleQuizGenerationAgent: ArticleQuizGenerationAgentPort,
        private readonly logger: LoggerPort,
    ) {}

    /**
     * Generate quiz questions for articles that don't have them yet
     * @param language - Target language for quiz generation
     * @param country - Target country for filtering articles
     * @returns Array of articles with newly generated quiz questions
     */
    public async execute(language: Language, country: Country): Promise<Article[]> {
        try {
            this.logger.info('Starting article challenges generation process', {
                country: country.toString(),
                language: language.toString(),
            });

            // Find articles that don't have quiz questions yet
            const articlesWithoutQuizzes = await this.articleRepository.findMany({
                country,
                excludeArchived: true,
                language,
                limit: 20, // Process in batches to avoid overwhelming the AI agent
            });

            // Filter to only articles that don't have quiz questions and are not fabricated
            const articlesToProcess = articlesWithoutQuizzes.filter(
                (article: Article) =>
                    (!article.quizQuestions || article.quizQuestions.isEmpty()) &&
                    !article.authenticity.isFabricated(),
            );

            if (articlesToProcess.length === 0) {
                this.logger.info('No non-fabricated articles found without quiz questions', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }

            this.logger.info('Articles found for quiz generation', {
                count: articlesToProcess.length,
            });

            const updatedArticles: Article[] = [];

            for (const article of articlesToProcess) {
                try {
                    this.logger.info('Generating quiz questions for article', {
                        articleId: article.id,
                        headline: article.headline.toString(),
                    });

                    const quizInput = {
                        articleContent: article.toFullArticleContent(),
                        targetLanguage: language,
                        traits: article.traits,
                    };

                    const quizResult = await this.articleQuizGenerationAgent.run(quizInput);

                    if (!quizResult || !quizResult.questions || quizResult.questions.length === 0) {
                        this.logger.warn('Quiz generation agent returned no questions', {
                            articleId: article.id,
                            country: country.toString(),
                            language: language.toString(),
                        });
                        continue;
                    }

                    // Create quiz questions from the AI response
                    const quizQuestions = new ArticleQuizQuestions(
                        quizResult.questions.map(
                            (q) =>
                                new ArticleQuizQuestion({
                                    answers: q.answers,
                                    correctAnswerIndex: q.correctAnswerIndex,
                                    question: q.question,
                                }),
                        ),
                    );

                    // Create a new article with quiz questions
                    const updatedArticle = new Article({
                        authenticity: article.authenticity,
                        body: article.body,
                        categories: article.categories,
                        country: article.country,
                        frames: article.frames,
                        headline: article.headline,
                        id: article.id,
                        language: article.language,
                        publishedAt: article.publishedAt,
                        quizQuestions,
                        reportIds: article.reportIds,
                        tier: article.tier,
                        traits: article.traits,
                    });

                    updatedArticles.push(updatedArticle);

                    this.logger.info('Quiz questions generated successfully', {
                        articleId: article.id,
                        questionsCount: quizQuestions.count(),
                    });
                } catch (articleError) {
                    this.logger.warn('Error generating quiz questions for article', {
                        articleId: article.id,
                        country: country.toString(),
                        error: articleError,
                        language: language.toString(),
                    });
                }
            }

            // Persist articles with new quiz questions
            if (updatedArticles.length > 0) {
                try {
                    await this.articleRepository.updateMany(updatedArticles);
                    this.logger.info('Article challenges generated and saved', {
                        count: updatedArticles.length,
                    });
                } catch (persistError) {
                    this.logger.error('Error persisting articles with quiz questions', {
                        country: country.toString(),
                        error: persistError,
                        language: language.toString(),
                    });
                    throw persistError;
                }
            }

            this.logger.info('Article challenges generation process completed', {
                country: country.toString(),
                generatedCount: updatedArticles.length,
                language: language.toString(),
                processedCount: articlesToProcess.length,
            });

            return updatedArticles;
        } catch (error) {
            this.logger.error('Article challenges generation failed', {
                country: country.toString(),
                error,
                language: language.toString(),
            });
            throw error;
        }
    }
}
