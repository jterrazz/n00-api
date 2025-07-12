import {
    type Article as PrismaArticle,
    type ArticleFrame as PrismaArticleFrame,
    type Category as PrismaCategory,
    type Country as PrismaCountry,
    type Discourse as PrismaDiscourse,
    type Language as PrismaLanguage,
    type Prisma,
    type Stance as PrismaStance,
} from '@prisma/client';

import { Article } from '../../../domain/entities/article.entity.js';
import { Authenticity } from '../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../domain/value-objects/article/headline.vo.js';
import { ArticleFrame } from '../../../domain/value-objects/article-frame/article-frame.vo.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { Language } from '../../../domain/value-objects/language.vo.js';
import { Classification } from '../../../domain/value-objects/report/classification.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';

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
            frames?: PrismaArticleFrame[];
            reports?: { classification: string; id: string }[];
        },
    ): Article {
        const frames = prisma.frames?.map(
            (frame) =>
                new ArticleFrame({
                    body: new Body(frame.body),
                    discourse: new Discourse(frame.discourse as PrismaDiscourse),
                    headline: new Headline(frame.headline),
                    stance: new Stance(frame.stance as PrismaStance),
                }),
        );

        return new Article({
            authenticity: new Authenticity(prisma.fakeStatus, prisma.fakeReason),
            body: new Body(prisma.body),
            category: new Category(prisma.category),
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
        });
    }

    toPrisma(domain: Article): Prisma.ArticleCreateInput {
        return {
            body: domain.body.value,
            category: this.mapCategoryToPrisma(domain.category),
            country: this.mapCountryToPrisma(domain.country),
            fakeReason: domain.authenticity.reason,
            fakeStatus: domain.isFake(),
            frames: domain.frames
                ? {
                      create: domain.frames.map((frame) => ({
                          body: frame.body.value,
                          discourse: frame.discourse.value,
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
        };
    }
}
