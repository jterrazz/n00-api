import { type Prisma } from '@prisma/client';

import type {
    ArticleRepositoryPort,
    CountManyOptions,
    FindHeadlinesAndSummariesOptions,
    FindManyOptions,
} from '../../../../application/ports/outbound/persistence/article-repository.port.js';

import type { Article } from '../../../../domain/entities/article.entity.js';

import type { PrismaAdapter } from '../prisma.adapter.js';

import { ArticleMapper } from './prisma-article.mapper.js';

export class PrismaArticleRepository implements ArticleRepositoryPort {
    private readonly mapper: ArticleMapper;

    constructor(private readonly prisma: PrismaAdapter) {
        this.mapper = new ArticleMapper();
    }

    async countMany(params: CountManyOptions): Promise<number> {
        const categoryFilter = this.mapper.createCategoryFilter(params.category, params.categories);

        const where = {
            ...(params.language && { language: this.mapper.mapLanguageToPrisma(params.language) }),
            ...(categoryFilter && categoryFilter),
            ...(params.country && { country: this.mapper.mapCountryToPrisma(params.country) }),
            ...(params.startDate &&
                params.endDate && {
                    createdAt: {
                        gte: params.startDate,
                        lte: params.endDate,
                    },
                }),
        };

        return this.prisma.getPrismaClient().article.count({ where });
    }

    async createMany(articles: Article[]): Promise<void> {
        await this.prisma.getPrismaClient().$transaction(
            articles.map((article) =>
                this.prisma.getPrismaClient().article.create({
                    data: this.mapper.toPrisma(article),
                }),
            ),
        );
    }

    async findHeadlinesAndSummaries(
        params: FindHeadlinesAndSummariesOptions,
    ): Promise<Array<{ headline: string; summary: string }>> {
        const where = {
            country: this.mapper.mapCountryToPrisma(params.country),
            language: this.mapper.mapLanguageToPrisma(params.language),
            ...(params.since && {
                createdAt: {
                    gte: params.since,
                },
            }),
        };

        const articles = await this.prisma.getPrismaClient().article.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                body: true,
                headline: true,
            },
            where,
        });

        return articles.map((article) => ({
            headline: article.headline,
            summary: article.body.substring(0, 200) + '...', // Generate summary from body // TODO FIx this
        }));
    }

    async findMany(options: FindManyOptions): Promise<Article[]> {
        const categoryFilter = this.mapper.createCategoryFilter(
            options.category,
            options.categories,
        );

        const where: Prisma.ArticleWhereInput = {
            ...(options.language && {
                language: this.mapper.mapLanguageToPrisma(options.language),
            }),
            ...(categoryFilter && categoryFilter),
            ...(options.country && { country: this.mapper.mapCountryToPrisma(options.country) }),
            ...(options.cursor && {
                publishedAt: {
                    lt: options.cursor,
                },
            }),
            ...(options.classification && {
                // Explicit inclusion filter (STANDARD / NICHE)
                reports: {
                    some: {
                        classification: {
                            in: options.classification,
                        },
                    },
                },
            }),
        };

        // If excludeArchived is true (default), exclude articles that are ARCHIVED.
        // This must allow articles with no reports (fake/unclassified) **or** reports with classification not ARCHIVED.
        if (!options.classification && options.excludeArchived !== false) {
            Object.assign(where, {
                OR: [
                    { reports: { none: {} } },
                    {
                        reports: {
                            some: {
                                classification: {
                                    not: 'ARCHIVED',
                                },
                            },
                        },
                    },
                ],
            });
        }

        const items = await this.prisma.getPrismaClient().article.findMany({
            include: {
                frames: true,
                quizQuestions: true,
                reports: {
                    select: {
                        classification: true,
                        id: true,
                    },
                    take: 1, // We only need the classification from one report
                },
            },
            orderBy: {
                publishedAt: 'desc',
            },
            take: options.limit + 1,
            where,
        });

        return items.map((item) => this.mapper.toDomain(item));
    }

    async updateMany(articles: Article[]): Promise<void> {
        if (articles.length === 0) {
            return;
        }

        const client = this.prisma.getPrismaClient();

        for (const article of articles) {
            await client.$transaction(async (tx) => {
                const prismaData = this.mapper.toPrisma(article);

                // Update the main article
                await tx.article.update({
                    data: {
                        body: prismaData.body,
                        categories: prismaData.categories,
                        country: prismaData.country,
                        fabricated: prismaData.fabricated,
                        fabricatedReason: prismaData.fabricatedReason,
                        headline: prismaData.headline,
                        language: prismaData.language,
                        publishedAt: prismaData.publishedAt,
                        traits: prismaData.traits,
                    },
                    where: { id: article.id },
                });

                // Handle quiz questions - delete existing and create new ones
                if (
                    prismaData.quizQuestions &&
                    typeof prismaData.quizQuestions === 'object' &&
                    'create' in prismaData.quizQuestions
                ) {
                    await tx.articleQuiz.deleteMany({
                        where: { articleId: article.id },
                    });

                    const quizData = prismaData.quizQuestions.create;
                    if (Array.isArray(quizData)) {
                        await tx.articleQuiz.createMany({
                            data: quizData.map((quiz) => ({
                                answers: quiz.answers,
                                articleId: article.id,
                                correctAnswerIndex: quiz.correctAnswerIndex,
                                question: quiz.question,
                            })),
                        });
                    }
                }

                // Handle frames - delete existing and create new ones if provided
                if (
                    prismaData.frames &&
                    typeof prismaData.frames === 'object' &&
                    'create' in prismaData.frames
                ) {
                    await tx.articleFrame.deleteMany({
                        where: { articleId: article.id },
                    });

                    const frameData = prismaData.frames.create;
                    if (Array.isArray(frameData)) {
                        await tx.articleFrame.createMany({
                            data: frameData.map((frame) => ({
                                articleId: article.id,
                                body: frame.body,
                                headline: frame.headline,
                            })),
                        });
                    }
                }
            });
        }
    }
}
