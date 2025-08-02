import {
    type Article as PrismaArticle,
    type ArticleFrame as PrismaArticleFrame,
    type Country as PrismaCountry,
    type Language as PrismaLanguage,
    type Prisma,
    type Stance as PrismaStance,
} from '@prisma/client';

import { Article } from '../../../../domain/entities/article.entity.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../../domain/value-objects/article/headline.vo.js';
import { ArticleFrame } from '../../../../domain/value-objects/article-frame/article-frame.vo.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { type Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';
import { Classification } from '../../../../domain/value-objects/report/classification.vo.js';
import { Stance } from '../../../../domain/value-objects/stance.vo.js';

export class ArticleMapper {
    /**
     * Creates a Prisma where condition for category filtering using JSON array operations
     */
    createCategoryFilter(category?: Category, categories?: Categories): object | undefined {
        if (categories) {
            // Filter articles that contain ANY of the specified categories
            return {
                categories: {
                    array_contains: categories.toArray(),
                },
            };
        }

        if (category) {
            // Filter articles that contain the specific category
            return {
                categories: {
                    array_contains: [category.value],
                },
            };
        }

        return undefined;
    }

    mapCategoriesToPrisma(categories: Categories): string[] {
        return categories.toArray();
    }

    mapCountryToPrisma(country: Country): PrismaCountry {
        return country.toString();
    }

    mapLanguageToPrisma(language: Language): PrismaLanguage {
        return language.toString();
    }

    toDomain(
        prisma: PrismaArticle & {
            frames?: PrismaArticleFrame[];
            reports?: { classification: string; id: string }[];
        },
    ): Article {
        const frames = prisma.frames?.map(
            (frame) =>
                new ArticleFrame({
                    body: new Body(frame.body),
                    headline: new Headline(frame.headline),
                    stance: new Stance(frame.stance as PrismaStance),
                }),
        );

        return new Article({
            authenticity: new Authenticity(
                prisma.authenticity === 'FABRICATED'
                    ? AuthenticityStatusEnum.FABRICATED
                    : AuthenticityStatusEnum.AUTHENTIC,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (prisma as any).clarification ?? (prisma as any).falsificationReason ?? null,
            ),
            body: new Body(prisma.body),
            categories: new Categories(
                Array.isArray(prisma.categories) ? (prisma.categories as string[]) : [],
            ),
            classification: prisma.reports?.[0]?.classification
                ? new Classification(
                      prisma.reports[0].classification as 'ARCHIVED' | 'NICHE' | 'STANDARD',
                  )
                : undefined,
            country: new Country(prisma.country),
            frames,
            headline: new Headline(prisma.headline),
            id: prisma.id,
            language: new Language(prisma.language),
            publishedAt: prisma.publishedAt,
            reportIds: prisma.reports?.map((report) => report.id),
            traits: ArticleTraits.fromJSON(prisma.traits || {}),
        });
    }

    toPrisma(domain: Article): Prisma.ArticleCreateInput {
        return {
            authenticity: domain.isFabricated() ? 'FABRICATED' : 'AUTHENTIC',
            body: domain.body.value,
            categories: this.mapCategoriesToPrisma(domain.categories),
            clarification: domain.authenticity.clarification,
            country: this.mapCountryToPrisma(domain.country),
            frames: domain.frames
                ? {
                      create: domain.frames.map((frame) => ({
                          body: frame.body.value,
                          headline: frame.headline.value,
                          stance: frame.stance.value,
                      })),
                  }
                : undefined,
            headline: domain.headline.value,
            id: domain.id,
            language: this.mapLanguageToPrisma(domain.language),
            publishedAt: domain.publishedAt,
            reports: domain.reportIds
                ? {
                      connect: domain.reportIds.map((id) => ({ id })),
                  }
                : undefined,
            traits: domain.traits.toJSON(),
        } as unknown as Prisma.ArticleCreateInput;
    }
}
