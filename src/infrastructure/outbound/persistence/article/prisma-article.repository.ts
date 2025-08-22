import { type Prisma } from '@prisma/client';

// Application
import type {
    ArticleRepositoryPort,
    CountManyOptions,
    FindHeadlinesAndSummariesOptions,
    FindManyOptions,
} from '../../../../application/ports/outbound/persistence/article/article-repository.port.js';

// Domain
import type { Article } from '../../../../domain/entities/article.entity.js';

import type { PrismaDatabase } from '../prisma.database.js';

import { ArticleMapper } from './prisma-article.mapper.js';

export class PrismaArticleRepository implements ArticleRepositoryPort {
    private readonly mapper: ArticleMapper;

    constructor(private readonly prisma: PrismaDatabase) {
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
            summary: article.body.substring(0, 200) + '...',
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
            ...(options.tier && {
                reports: {
                    some: {
                        tier: {
                            in: options.tier,
                        },
                    },
                },
            }),
        };

        if (!options.tier && options.excludeArchived !== false) {
            Object.assign(where, {
                OR: [
                    { reports: { none: {} } },
                    {
                        reports: {
                            some: {
                                tier: {
                                    not: 'OFF_TOPIC',
                                },
                            },
                        },
                    },
                ],
            });
        }

        const items = await this.prisma.getPrismaClient().article.findMany({
            include: {
                categories: true,
                frames: true,
                quizQuestions: true,
                reports: {
                    select: {
                        id: true,
                        tier: true,
                    },
                    take: 1,
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

    async findManyByIds(ids: string[]): Promise<Article[]> {
        if (ids.length === 0) return [];

        const items = await this.prisma.getPrismaClient().article.findMany({
            include: {
                categories: true,
                frames: true,
                quizQuestions: true,
                reports: {
                    select: { id: true, tier: true },
                    take: 1,
                },
            },
            where: { id: { in: ids } },
        });

        const mapped = items.map((item) => this.mapper.toDomain(item));
        const orderMap = new Map(ids.map((id, index) => [id, index] as const));
        mapped.sort((a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!);
        return mapped;
    }

    async updateMany(articles: Article[]): Promise<void> {
        if (articles.length === 0) {
            return;
        }

        const client = this.prisma.getPrismaClient();

        for (const article of articles) {
            await client.$transaction(async (tx) => {
                const prismaData = this.mapper.toPrisma(article);

                await tx.article.update({
                    data: {
                        body: prismaData.body,
                        country: prismaData.country,
                        fabricated: prismaData.fabricated,
                        fabricatedReason: prismaData.fabricatedReason,
                        headline: prismaData.headline,
                        language: prismaData.language,
                        publishedAt: prismaData.publishedAt,
                    },
                    where: { id: article.id },
                });

                if (
                    prismaData.quizQuestions &&
                    typeof prismaData.quizQuestions === 'object' &&
                    'create' in prismaData.quizQuestions
                ) {
                    await tx.articleQuiz.deleteMany({ where: { articleId: article.id } });
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

                if (
                    prismaData.frames &&
                    typeof prismaData.frames === 'object' &&
                    'create' in prismaData.frames
                ) {
                    await tx.articleFrame.deleteMany({ where: { articleId: article.id } });
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
