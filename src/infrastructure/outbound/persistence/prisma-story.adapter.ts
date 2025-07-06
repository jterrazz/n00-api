import { type LoggerPort } from '@jterrazz/logger';

import { type StoryRepositoryPort } from '../../../application/ports/outbound/persistence/story-repository.port.js';

import { type Story } from '../../../domain/entities/story.entity.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';

import { type PrismaAdapter } from './prisma.adapter.js';
import { StoryMapper } from './prisma-story.mapper.js';

export class PrismaStoryRepository implements StoryRepositoryPort {
    private readonly mapper: StoryMapper;

    constructor(
        private readonly prisma: PrismaAdapter,
        private readonly logger: LoggerPort,
    ) {
        this.mapper = new StoryMapper();
    }

    async addSourceReferences(storyId: string, sourceIds: string[]): Promise<void> {
        const story = await this.prisma.getPrismaClient().story.findUnique({
            select: { sourceReferences: true },
            where: { id: storyId },
        });

        if (!story) {
            this.logger.warn(`Story with id ${storyId} not found. Cannot add source references.`);
            return;
        }

        const existingSources = (story.sourceReferences as string[]) || [];
        const updatedSources = Array.from(new Set([...existingSources, ...sourceIds]));

        await this.prisma.getPrismaClient().story.update({
            data: {
                sourceReferences: updatedSources,
            },
            where: { id: storyId },
        });
    }

    async create(story: Story): Promise<Story> {
        const prismaClient = this.prisma.getPrismaClient();

        // Use transaction to create story with perspectives
        const result = await prismaClient.$transaction(async (tx) => {
            // Create the story
            const createdStory = await tx.story.create({
                data: this.mapper.toPrisma(story),
            });

            // Create perspectives
            for (const perspective of story.perspectives) {
                await tx.storyPerspective.create({
                    data: this.mapper.perspectiveToPrisma(perspective, createdStory.id),
                });
            }

            // Return the created story with perspectives
            return await tx.story.findUnique({
                include: {
                    perspectives: true,
                },
                where: { id: createdStory.id },
            });
        });

        if (!result) {
            throw new Error('Failed to create story');
        }

        return this.mapper.toDomain(result);
    }

    async findById(id: string): Promise<null | Story> {
        const prismaStory = await this.prisma.getPrismaClient().story.findUnique({
            include: {
                perspectives: true,
            },
            where: { id },
        });

        return prismaStory ? this.mapper.toDomain(prismaStory) : null;
    }

    async findMany(criteria: {
        category?: string;
        country?: string;
        endDate?: Date;
        limit?: number;
        offset?: number;
        startDate?: Date;
        where?: {
            classification?: 'PENDING_CLASSIFICATION';
        };
    }): Promise<Story[]> {
        const where: Record<string, unknown> = {};

        // Category filter
        if (criteria.category) {
            where.category = criteria.category.toUpperCase();
        }

        // Country filter
        if (criteria.country) {
            where.country = criteria.country;
        }

        // Date range filter
        if (criteria.startDate && criteria.endDate) {
            where.dateline = {
                gte: criteria.startDate,
                lte: criteria.endDate,
            };
        }

        // Classification filter
        if (criteria.where?.classification) {
            where.classification = criteria.where.classification;
        }

        const stories = await this.prisma.getPrismaClient().story.findMany({
            include: {
                perspectives: true,
            },
            orderBy: {
                dateline: 'desc',
            },
            skip: criteria.offset,
            take: criteria.limit,
            where,
        });

        return stories.map((story) => this.mapper.toDomain(story));
    }

    async findRecentSynopses(options: {
        country: Country;
        language: Language;
        since: Date;
    }): Promise<Array<{ id: string; synopsis: string }>> {
        const stories = await this.prisma.getPrismaClient().story.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                synopsis: true,
            },
            take: 100, // Limit to a reasonable number for performance
            where: {
                country: this.mapper.mapCountryToPrisma(options.country),
                createdAt: {
                    gte: options.since,
                },
            },
        });
        return stories;
    }

    async findStoriesWithoutArticles(criteria?: {
        category?: string;
        classification?: Array<'NICHE' | 'PENDING_CLASSIFICATION' | 'STANDARD'>;
        country?: string;
        limit?: number;
    }): Promise<Story[]> {
        const where: Record<string, unknown> = {
            articles: {
                none: {}, // Stories that have no articles linked
            },
        };

        // Category filter
        if (criteria?.category) {
            where.category = criteria.category;
        }

        // Country filter
        if (criteria?.country) {
            where.country = criteria.country;
        }

        // Classification filter
        if (criteria?.classification && criteria.classification.length > 0) {
            where.classification = { in: criteria.classification };
        }

        const stories = await this.prisma.getPrismaClient().story.findMany({
            include: {
                perspectives: true,
            },
            orderBy: {
                dateline: 'desc',
            },
            take: criteria?.limit || 50,
            where,
        });

        return stories.map((story) => this.mapper.toDomain(story));
    }

    async getAllSourceReferences(country: Country): Promise<string[]> {
        const stories = await this.prisma.getPrismaClient().story.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                sourceReferences: true,
            },
            take: 2000,
            where: {
                country: this.mapper.mapCountryToPrisma(country),
            },
        });

        // Extract all source references from all stories
        const sourceReferences = stories.flatMap((story) => story.sourceReferences as string[]);

        return sourceReferences;
    }

    async update(id: string, data: Partial<Story>): Promise<Story> {
        const updateData: Record<string, unknown> = {};

        if (data.classification) {
            updateData.classification = data.classification.toString();
        }

        const updatedStory = await this.prisma.getPrismaClient().story.update({
            data: updateData,
            include: {
                perspectives: true,
            },
            where: { id },
        });

        return this.mapper.toDomain(updatedStory);
    }
}
