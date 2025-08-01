import { type Category, type Country, type Language } from '@prisma/client';

import { type GetArticlesResult } from '../../../../application/use-cases/articles/get-articles.use-case.js';

import { type Article } from '../../../../domain/entities/article.entity.js';

type ArticleFrameResponse = {
    body: string;
    headline: string;
    stance: string;
};

type ArticleInteractions = {
    authenticityChallenge: {
        enable: boolean;
        explanation: string;
    };
    insights: Array<{
        agent: string;
        analysis: string;
        duration: string;
        enable: boolean;
        publishedAt: string;
    }>;
    quiz: {
        enable: boolean;
        questions: Array<{
            answers: string[];
            correctAnswerIndex: number;
            question: string;
        }>;
    };
};

type ArticleMetadata = {
    authenticity: 'authentic' | 'fabricated';
    categories: Category[];
    classification?: 'ARCHIVED' | 'NICHE' | 'STANDARD';
    country: Country;
    language: Language;
};

type ArticleResponse = {
    body: string;
    frames: ArticleFrameResponse[];
    headline: string;
    id: string;
    interactions: ArticleInteractions;
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
                stance: frame.stance.value,
            })) ?? [];

        return {
            body: displayBody,
            frames,
            headline: article.headline.toString(),
            id: article.id,
            interactions: {
                authenticityChallenge: {
                    enable: false,
                    explanation: '',
                },
                insights: [],
                quiz: {
                    enable: false,
                    questions: [],
                },
            },
            metadata: {
                authenticity: article.isFabricated() ? 'fabricated' : 'authentic',
                categories: article.categories.toArray() as Category[],
                classification: article.classification?.toString() as
                    | 'ARCHIVED'
                    | 'NICHE'
                    | 'STANDARD'
                    | undefined,
                country: article.country.toString() as Country,
                language: article.language.toString() as Language,
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
