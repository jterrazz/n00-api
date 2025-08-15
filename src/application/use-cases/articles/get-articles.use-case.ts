// Domain
import { type Article } from '../../../domain/entities/article.entity.js';
import { type Category } from '../../../domain/value-objects/category.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

// Ports
import { type ArticleRepositoryPort } from '../../ports/outbound/persistence/article-repository.port.js';

/**
 * Input parameters for the GetArticles use case using domain value objects
 */
export interface GetArticlesParams {
    category?: Category;
    country: Country;
    cursor?: Date;
    ids?: string[];
    language?: Language;
    limit: number;
}

/**
 * Result returned by GetArticlesUseCase containing the raw domain articles and
 * additional pagination metadata.
 */
export interface GetArticlesResult {
    /** Raw domain articles list */
    articles: Article[];
    /**
     * Date of the last item in the current page **only if** there is another page.
     * When there are no further pages, this is `null` so the presenter can omit
     * the `nextCursor` value.
     */
    lastItemDate: Date | null;
    /** Total number of articles matching the filters. */
    total: number;
}

export class GetArticlesUseCase {
    constructor(private readonly articleRepository: ArticleRepositoryPort) {}

    async execute(params: GetArticlesParams): Promise<GetArticlesResult> {
        const { category, country, cursor, ids, language, limit } = params;

        if (ids && ids.length > 0) {
            const articles = await this.articleRepository.findManyByIds(ids);
            // When querying by ids, ignore pagination and filtering
            return { articles, lastItemDate: null, total: articles.length };
        }

        const [rawArticles, total] = await Promise.all([
            this.articleRepository.findMany({
                category,
                country,
                cursor,
                excludeArchived: true,
                language,
                limit: limit + 1,
            }),
            this.articleRepository.countMany({ category, country, language }),
        ]);

        const hasMore = rawArticles.length > limit;
        const results = hasMore ? rawArticles.slice(0, limit) : rawArticles;

        const lastItemDate =
            hasMore && results.length > 0 ? results[results.length - 1].publishedAt : null;

        return {
            articles: results,
            lastItemDate,
            total,
        };
    }
}
