import { type LoggerPort } from '@jterrazz/logger';
import { type Prisma } from '../../../../generated/prisma/client.js';

// Application
import { type ReportRepositoryPort } from '../../../../application/ports/outbound/persistence/report/report-repository.port.js';

// Domain
import { type Report } from '../../../../domain/entities/report.entity.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

import { type PrismaDatabase } from '../prisma.database.js';

import { ReportMapper } from './prisma-report.mapper.js';

export class PrismaReportRepository implements ReportRepositoryPort {
    private readonly mapper: ReportMapper;

    constructor(
        private readonly prisma: PrismaDatabase,
        private readonly logger: LoggerPort,
    ) {
        this.mapper = new ReportMapper();
    }

    async addSourceReferences(reportId: string, sourceIds: string[]): Promise<void> {
        const report = await this.prisma.getPrismaClient().report.findUnique({
            select: { sources: true },
            where: { id: reportId },
        });

        if (!report) {
            this.logger.warn(`Report with id ${reportId} not found. Cannot add source references.`);
            return;
        }

        const existingSources = (report.sources as string[]) || [];
        const updatedSources = Array.from(new Set([...existingSources, ...sourceIds]));

        await this.prisma.getPrismaClient().report.update({
            data: { sources: updatedSources },
            where: { id: reportId },
        });
    }

    async countByDateRange(country: Country, from: Date, to: Date): Promise<number> {
        return await this.prisma.getPrismaClient().report.count({
            where: {
                country: this.mapper.mapCountryToPrisma(country),
                createdAt: { gte: from, lte: to },
            },
        });
    }

    async create(report: Report): Promise<Report> {
        const prismaClient = this.prisma.getPrismaClient();

        const result = await prismaClient.$transaction(async (tx) => {
            const createdReport = await tx.report.create({ data: this.mapper.toPrisma(report) });
            for (const angle of report.angles) {
                await tx.reportAngle.create({
                    data: this.mapper.angleToPrisma(angle, createdReport.id),
                });
            }
            return await tx.report.findUnique({
                include: { angles: true, categories: true },
                where: { id: createdReport.id },
            });
        });

        if (!result) {
            throw new Error('Failed to create report');
        }
        return this.mapper.toDomain(result);
    }

    async createDuplicate(report: Report, options: { duplicateOfId: string }): Promise<Report> {
        const prismaClient = this.prisma.getPrismaClient();

        const result = await prismaClient.$transaction(async (tx) => {
            const duplicateData = {
                ...this.mapper.toPrisma(report),
                duplicateOfId: options.duplicateOfId,
            } as unknown as Prisma.ReportCreateInput;

            const createdReport = await tx.report.create({ data: duplicateData });
            for (const angle of report.angles) {
                await tx.reportAngle.create({
                    data: this.mapper.angleToPrisma(angle, createdReport.id),
                });
            }
            return await tx.report.findUnique({
                include: { angles: true, categories: true },
                where: { id: createdReport.id },
            });
        });

        if (!result) {
            throw new Error('Failed to create duplicate report');
        }
        return this.mapper.toDomain(result);
    }

    async findById(id: string): Promise<null | Report> {
        const prismaReport = await this.prisma.getPrismaClient().report.findUnique({
            include: { angles: true, categories: true },
            where: { id },
        });
        return prismaReport ? this.mapper.toDomain(prismaReport) : null;
    }

    async findMany(criteria: {
        category?: string;
        country?: string;
        endDate?: Date;
        limit?: number;
        offset?: number;
        startDate?: Date;
        where?: { classificationState?: 'PENDING' };
    }): Promise<Report[]> {
        const where: Record<string, unknown> = {};
        if (criteria.category) {
            const categoryFilter = this.mapper.createCategoryFilter(criteria.category);
            if (categoryFilter) Object.assign(where, categoryFilter);
        }
        if (criteria.country) where.country = criteria.country;
        if (criteria.startDate && criteria.endDate) {
            where.dateline = { gte: criteria.startDate, lte: criteria.endDate };
        }
        if (criteria.where?.classificationState) {
            where.classificationState = criteria.where.classificationState;
        }
        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: { angles: true, categories: true },
            orderBy: { dateline: 'desc' },
            skip: criteria.offset,
            take: criteria.limit,
            where,
        });
        return reports.map((r) => this.mapper.toDomain(r));
    }

    async findRecentFacts(options: {
        country: Country;
        language: Language;
        since: Date;
    }): Promise<Array<{ facts: string; id: string }>> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            orderBy: { createdAt: 'desc' },
            select: { core: true, id: true },
            take: 100,
            where: {
                country: this.mapper.mapCountryToPrisma(options.country),
                createdAt: { gte: options.since },
            },
        });
        return reports.map((report) => ({
            facts: report.core,
            id: report.id,
        }));
    }

    async findRecentReports(criteria: {
        country?: string;
        excludeIds?: string[];
        limit?: number;
        since: Date;
    }): Promise<Report[]> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: { angles: true, categories: true },
            orderBy: { createdAt: 'desc' },
            take: criteria.limit ?? 1000,
            where: {
                country: criteria.country
                    ? this.mapper.mapCountryToPrisma(new Country(criteria.country))
                    : undefined,
                createdAt: { gte: criteria.since },
                deduplicationState: 'COMPLETE',
                id: criteria.excludeIds ? { notIn: criteria.excludeIds } : undefined,
            },
        });
        return reports.map((report) => this.mapper.toDomain(report));
    }

    async findReportsWithoutArticles(criteria?: {
        category?: string;
        classificationState?: 'COMPLETE' | 'PENDING';
        country?: string;
        limit?: number;
        tier?: Array<'GENERAL' | 'NICHE' | 'OFF_TOPIC'>;
    }): Promise<Report[]> {
        const where: Record<string, unknown> = { articles: { none: {} } };
        if (criteria?.category) {
            const categoryFilter = this.mapper.createCategoryFilter(criteria.category);
            if (categoryFilter) Object.assign(where, categoryFilter);
        }
        if (criteria?.country) where.country = criteria.country;
        if (criteria?.classificationState) where.classificationState = criteria.classificationState;
        if (criteria?.tier && criteria.tier.length > 0) {
            where.tier = { in: criteria.tier };
        }
        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: { angles: true, categories: true },
            orderBy: { dateline: 'desc' },
            take: criteria?.limit || 50,
            where,
        });
        return reports.map((r) => this.mapper.toDomain(r));
    }

    async findReportsWithPendingDeduplication(criteria?: {
        country?: string;
        limit?: number;
    }): Promise<Report[]> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: { angles: true, categories: true },
            orderBy: { createdAt: 'asc' },
            take: criteria?.limit ?? 50,
            where: {
                country: criteria?.country
                    ? this.mapper.mapCountryToPrisma(new Country(criteria.country))
                    : undefined,
                deduplicationState: 'PENDING',
            },
        });
        return reports.map((report) => this.mapper.toDomain(report));
    }

    async getAllSourceReferences(country?: Country): Promise<string[]> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            orderBy: { createdAt: 'desc' },
            select: { sources: true },
            take: 5000,
            where: country ? { country: this.mapper.mapCountryToPrisma(country) } : undefined,
        });
        const allSourceReferences = reports
            .flatMap((report) => report.sources as string[])
            .filter((ref, index, arr) => arr.indexOf(ref) === index);
        return allSourceReferences;
    }

    async markAsDuplicate(reportId: string, options: { duplicateOfId: string }): Promise<Report> {
        const updatedReport = await this.prisma.getPrismaClient().report.update({
            data: {
                deduplicationState: 'COMPLETE',
                duplicateOfId: options.duplicateOfId,
            },
            include: { angles: true, categories: true },
            where: { id: reportId },
        });
        return this.mapper.toDomain(updatedReport);
    }

    async update(id: string, data: Partial<Report>): Promise<Report> {
        const updateData: Record<string, unknown> = {};
        if (data.classificationState)
            updateData.classificationState = data.classificationState.toString();
        if (data.tier) updateData.tier = data.tier.toString();
        if (data.deduplicationState)
            updateData.deduplicationState = data.deduplicationState.toString();
        if (data.traits) {
            updateData.traitsEssential = data.traits.essential;
            updateData.traitsPositive = data.traits.positive;
        }
        const updatedReport = await this.prisma.getPrismaClient().report.update({
            data: updateData,
            include: { angles: true, categories: true },
            where: { id },
        });
        return this.mapper.toDomain(updatedReport);
    }
}
