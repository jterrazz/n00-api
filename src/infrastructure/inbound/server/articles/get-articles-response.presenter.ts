import { type Category, type Country, type Language } from '@prisma/client';

import { type PaginatedResponse as UseCasePaginatedResponse } from '../../../../application/use-cases/articles/get-articles.use-case.js';

import { type Article } from '../../../../domain/entities/article.entity.js';

type ArticleMetadata = {
    category: Category;
    classification?: 'ARCHIVED' | 'NICHE' | 'STANDARD';
    country: Country;
    language: Language;
};

type ArticleResponse = {
    authenticity: {
        reason?: string;
        status: 'authentic' | 'fake';
    };
    body: string;
    headline: string;
    id: string;
    metadata: ArticleMetadata;
    publishedAt: string;
    variants: ArticleVariantResponse[];
};

type ArticleVariantResponse = {
    body: string;
    discourse: string;
    headline: string;
    stance: string;
};

type HttpPaginatedResponse<T> = {
    items: T[];
    nextCursor: null | string;
    total: number;
};

/**
 * Handles response formatting for GET /articles endpoint
 * Transforms domain objects to HTTP response format with clean article + variants structure
 */
export class GetArticlesResponsePresenter {
    present(result: UseCasePaginatedResponse<Article>): HttpPaginatedResponse<ArticleResponse> {
        const articles: ArticleResponse[] = result.items.map((article) =>
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
        const displayBody = article.isFake() ? contentWithAnnotations : contentRaw;

        // Map article variants from domain entities
        const variants: ArticleVariantResponse[] =
            article.variants?.map((variant) => ({
                body: variant.body.toString(),
                discourse: variant.discourse,
                headline: variant.headline.toString(),
                stance: variant.stance,
            })) ?? [];

        return {
            authenticity: {
                reason: article.authenticity.reason ?? undefined,
                status: article.isFake() ? 'fake' : 'authentic',
            },
            body: displayBody,
            headline: article.headline.toString(),
            id: article.id,
            metadata: {
                category: article.category.toString() as Category,
                classification: article.classification?.toString() as
                    | 'ARCHIVED'
                    | 'NICHE'
                    | 'STANDARD'
                    | undefined,
                country: article.country.toString() as Country,
                language: article.language.toString() as Language,
            },
            publishedAt: article.publishedAt.toISOString(),
            variants,
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
