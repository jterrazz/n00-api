import { type Article } from '../../../domain/entities/article.entity.js';
import { type Category } from '../../../domain/value-objects/category.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article-repository.port.js';

/**
 * Input parameters for the GetArticles use case using domain value objects
 */
export interface GetArticlesParams {
    category?: Category;
    country: Country;
    cursor?: Date;
    language?: Language;
    limit: number;
}

export type PaginatedResponse<T> = {
    items: T[];
    lastItemDate: Date | null;
    total: number;
};

export class GetArticlesUseCase {
    constructor(private readonly articleRepository: ArticleRepositoryPort) {}

    async execute(params: GetArticlesParams): Promise<PaginatedResponse<Article>> {
        const { category, country, cursor, language, limit } = params;

        const [articles, total] = await Promise.all([
            this.articleRepository.findMany({
                category,
                classification: ['STANDARD', 'NICHE'],
                country,
                cursor,
                language,
                limit: limit + 1,
            }),
            this.articleRepository.countMany({
                category,
                country,
                language,
            }),
        ]);

        const hasMore = articles.length > limit;
        const results = hasMore ? articles.slice(0, limit) : articles;

        const lastItemDate =
            hasMore && results.length > 0 ? results[results.length - 1].publishedAt : null;

        return {
            items: results,
            lastItemDate,
            total,
        };
    }
}
