import {
    type Article as PrismaArticle,
    type ArticleVariant as PrismaArticleVariant,
    type Category as PrismaCategory,
    type Country as PrismaCountry,
    type Discourse,
    type Language as PrismaLanguage,
    type Prisma,
    type Stance,
} from '@prisma/client';

import { Article } from '../../../domain/entities/article.entity.js';
import { ArticleVariant } from '../../../domain/value-objects/article/article-variant.vo.js';
import { Authenticity } from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { Country } from '../../../domain/value-objects/country.vo.js';
import { Language } from '../../../domain/value-objects/language.vo.js';
import { Classification } from '../../../domain/value-objects/story/classification.vo.js';

export class ArticleMapper {
    mapCategoryToPrisma(category: Category): PrismaCategory {
        return category.toString() as PrismaCategory;
    }

    mapCountryToPrisma(country: Country): PrismaCountry {
        return country.toString();
    }

    mapLanguageToPrisma(language: Language): PrismaLanguage {
        return language.toString();
    }

    toDomain(
        prisma: PrismaArticle & {
            stories?: { classification: string; id: string }[];
            variants?: PrismaArticleVariant[];
        },
    ): Article {
        const variants = prisma.variants?.map(
            (variant) =>
                new ArticleVariant({
                    body: new Body(variant.body),
                    discourse: variant.discourse,
                    headline: new Headline(variant.headline),
                    stance: variant.stance,
                }),
        );

        return new Article({
            authenticity: new Authenticity(prisma.fakeStatus, prisma.fakeReason),
            body: new Body(prisma.body),
            category: new Category(prisma.category),
            classification: prisma.stories?.[0]?.classification
                ? new Classification(
                      prisma.stories[0].classification as 'ARCHIVED' | 'NICHE' | 'STANDARD',
                  )
                : undefined,
            country: new Country(prisma.country),
            headline: new Headline(prisma.headline),
            id: prisma.id,
            language: new Language(prisma.language),
            publishedAt: prisma.publishedAt,
            storyIds: prisma.stories?.map((story) => story.id),
            variants,
        });
    }

    toPrisma(domain: Article): Prisma.ArticleCreateInput {
        return {
            body: domain.body.value,
            category: this.mapCategoryToPrisma(domain.category),
            country: this.mapCountryToPrisma(domain.country),
            fakeReason: domain.authenticity.reason,
            fakeStatus: domain.isFake(),
            headline: domain.headline.value,
            id: domain.id,
            language: this.mapLanguageToPrisma(domain.language),
            publishedAt: domain.publishedAt,
            stories: domain.storyIds
                ? {
                      connect: domain.storyIds.map((id) => ({ id })),
                  }
                : undefined,
            variants: domain.variants
                ? {
                      create: domain.variants.map((variant) => ({
                          body: variant.body.value,
                          discourse: variant.discourse as Discourse,
                          headline: variant.headline.value,
                          stance: variant.stance as Stance,
                      })),
                  }
                : undefined,
        };
    }
}
