import {
    type Prisma,
    type Article as PrismaArticle,
    type ArticleFrame as PrismaArticleFrame,
    type ArticleQuiz as PrismaArticleQuiz,
    type Country as PrismaCountry,
    type Language as PrismaLanguage,
} from '@prisma/client';

// Domain
import { Article } from '../../../../domain/entities/article.entity.js';
import { ArticleFrame } from '../../../../domain/value-objects/article-frame/article-frame.vo.js';
import { ArticleQuizQuestion } from '../../../../domain/value-objects/article-quiz-question.vo.js';
import { ArticleQuizQuestions } from '../../../../domain/value-objects/article-quiz-questions.vo.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../../../domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../../../domain/value-objects/article/body.vo.js';
import { Headline } from '../../../../domain/value-objects/article/headline.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { type Category } from '../../../../domain/value-objects/category.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Language } from '../../../../domain/value-objects/language.vo.js';
import { Classification } from '../../../../domain/value-objects/report/tier.vo.js';

export class ArticleMapper {
    /**
     * Creates a Prisma where condition for category filtering using join table
     */
    createCategoryFilter(category?: Category, categories?: Categories): object | undefined {
        if (categories && categories.toArray().length > 0) {
            return {
                categories: {
                    some: {
                        category: { in: categories.toArray() },
                    },
                },
            };
        }

        if (category) {
            return {
                categories: {
                    some: {
                        category: category.value,
                    },
                },
            };
        }

        return undefined;
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
            quizQuestions?: PrismaArticleQuiz[];
            reports?: { tier: null | string; id: string }[];
        },
    ): Article {
        const frames = prisma.frames?.map(
            (frame) =>
                new ArticleFrame({
                    body: new Body(frame.body),
                    headline: new Headline(frame.headline),
                }),
        );

        const quizQuestions = prisma.quizQuestions?.length
            ? new ArticleQuizQuestions(
                  prisma.quizQuestions.map(
                      (quiz) =>
                          new ArticleQuizQuestion({
                              answers: Array.isArray(quiz.answers)
                                  ? (quiz.answers as string[])
                                  : [],
                              correctAnswerIndex: quiz.correctAnswerIndex,
                              question: quiz.question,
                          }),
                  ),
              )
            : undefined;

        return new Article({
            authenticity: new Authenticity(
                (prisma as PrismaArticle & { fabricated: boolean }).fabricated
                    ? AuthenticityStatusEnum.FABRICATED
                    : AuthenticityStatusEnum.AUTHENTIC,
                (prisma as PrismaArticle & { fabricatedReason?: string }).fabricatedReason ?? null,
            ),
            body: new Body(prisma.body),
            categories: (() => {
                const joinCats = (prisma as unknown as { categories?: Array<{ category: string }> })
                    .categories;
                const values = Array.isArray(joinCats)
                    ? (joinCats.map((c) => c.category) as string[])
                    : [];
                return new Categories(values.length > 0 ? values : ['OTHER']);
            })(),
            tier: prisma.reports?.[0]?.tier
                ? new Classification(prisma.reports[0].tier as 'GENERAL' | 'NICHE' | 'OFF_TOPIC')
                : undefined,
            country: new Country(prisma.country),
            frames,
            headline: new Headline(prisma.headline),
            id: prisma.id,
            language: new Language(prisma.language),
            publishedAt: prisma.publishedAt,
            quizQuestions,
            reportIds: prisma.reports?.map((report) => report.id),
            traits: new ArticleTraits({
                smart: (prisma as unknown as { traitsSmart?: boolean }).traitsSmart ?? false,
                uplifting:
                    (prisma as unknown as { traitsUplifting?: boolean }).traitsUplifting ?? false,
            }),
        });
    }

    toPrisma(domain: Article): Prisma.ArticleCreateInput {
        return {
            body: domain.body.value,
            categories: {
                create: domain.categories.toArray().map((c) => ({ category: c })),
            },
            country: this.mapCountryToPrisma(domain.country),
            fabricated: domain.isFabricated(),
            fabricatedReason: domain.authenticity.clarification,
            frames: domain.frames
                ? {
                      create: domain.frames.map((frame) => ({
                          body: frame.body.value,
                          headline: frame.headline.value,
                      })),
                  }
                : undefined,
            headline: domain.headline.value,
            id: domain.id,
            language: this.mapLanguageToPrisma(domain.language),
            publishedAt: domain.publishedAt,
            quizQuestions:
                domain.quizQuestions && !domain.quizQuestions.isEmpty()
                    ? {
                          create: domain.quizQuestions.toArray().map((quiz) => ({
                              answers: quiz.answers,
                              correctAnswerIndex: quiz.correctAnswerIndex,
                              question: quiz.question,
                          })),
                      }
                    : undefined,
            reports: domain.reportIds
                ? {
                      connect: domain.reportIds.map((id) => ({ id })),
                  }
                : undefined,
            // Removed JSON traits - using typed columns only
            traitsSmart: domain.traits.smart,
            traitsUplifting: domain.traits.uplifting,
        } as unknown as Prisma.ArticleCreateInput;
    }
}
