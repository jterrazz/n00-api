import { type Category, type Country, type Language } from '../../../../generated/prisma/client.js';

// Application
import { type GetArticlesResult } from '../../../../application/use-cases/articles/get-articles.use-case.js';

// Domain
import { type Article } from '../../../../domain/entities/article.entity.js';

type ArticleChallenges = {
    authenticity: {
        enable: boolean;
        explanation: string;
    };
    quiz: {
        enable: boolean;
        questions: Array<{
            answers: string[];
            correctAnswerIndex: number;
            question: string;
        }>;
    };
};

type ArticleFrameResponse = {
    body: string;
    headline: string;
};

type ArticleInsights = Array<{
    agent: string;
    analysis: string;
    duration: string;
    enable: boolean;
    publishedAt: string;
}>;

type ArticleMetadata = {
    categories: Category[];
    country: Country;
    fabricated: boolean;
    language: Language;
    tier?: 'GENERAL' | 'NICHE' | 'OFF_TOPIC';
    traits: {
        essential: boolean;
        positive: boolean;
    };
};

type ArticleResponse = {
    body: string;
    challenges: ArticleChallenges;
    frames: ArticleFrameResponse[];
    headline: string;
    id: string;
    insights: ArticleInsights;
    metadata: ArticleMetadata;
    publishedAt: string;
};

type HttpPaginatedResponse<T> = {
    items: T[];
    nextCursor: null | string;
    total: number;
};

/**
 * Handles response formatting for GET /articles endpoint
 * Transforms domain objects to HTTP response format with clean article + frames structure
 */
export class GetArticlesResponsePresenter {
    present(result: GetArticlesResult): HttpPaginatedResponse<ArticleResponse> {
        const articles: ArticleResponse[] = result.articles.map((article) =>
            this.mapArticleToResponse(article),
        );

        const nextCursor = result.lastItemDate
            ? Buffer.from(result.lastItemDate.getTime().toString()).toString('base64')
            : null;

        return {
            items: articles,
            nextCursor,
            total: result.total,
        };
    }

    private mapArticleToResponse(article: Article): ArticleResponse {
        const content = article.body.toString();
        const { contentRaw, contentWithAnnotations } = this.processContent(content);

        // Use processed content based on authenticity
        const displayBody = article.isFabricated() ? contentWithAnnotations : contentRaw;

        // Map article frames from domain entities
        const frames: ArticleFrameResponse[] =
            article.frames?.map((frame) => ({
                body: frame.body.toString(),
                headline: frame.headline.toString(),
            })) ?? [];

        return {
            body: displayBody,
            challenges: {
                authenticity: {
                    enable: article.shouldShowAuthenticityChallenge(),
                    explanation: article.authenticity.clarification ?? '',
                },
                quiz: {
                    enable: Boolean(article.quizQuestions && !article.quizQuestions.isEmpty()),
                    questions:
                        article.quizQuestions?.toArray().map((quiz) => ({
                            answers: quiz.answers,
                            correctAnswerIndex: quiz.correctAnswerIndex,
                            question: quiz.question,
                        })) ?? [],
                },
            },
            frames,
            headline: article.headline.toString(),
            id: article.id,
            insights: [],
            metadata: {
                categories: article.categories.toArray() as Category[],
                country: article.country.toString() as Country,
                fabricated: article.isFabricated(),
                language: article.language.toString() as Language,
                tier: article.tier?.toString() as 'GENERAL' | 'NICHE' | 'OFF_TOPIC' | undefined,
                traits: {
                    essential: article.traits.essential,
                    positive: article.traits.positive,
                },
            },
            publishedAt: article.publishedAt.toISOString(),
        };
    }

    private processContent(content: string): {
        contentRaw: string;
        contentWithAnnotations: string;
    } {
        // Pattern: %%[(word)]( description)%% -> extract "word description" for contentRaw
        // The first group captures everything inside [], the second captures everything inside ()
        let contentRaw = content.replace(/%%\[\((.*?)\)\]\(\s*([^)]*)\)%%/g, '$1 $2');
        let contentWithAnnotations = content;

        // Clean up any remaining %% artifacts
        contentRaw = contentRaw.replace(/%%/g, '');
        contentWithAnnotations = contentWithAnnotations.replace(/\)%%/g, ')');

        return {
            contentRaw,
            contentWithAnnotations,
        };
    }
}
