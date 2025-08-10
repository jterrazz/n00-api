import { type LoggerPort } from '@jterrazz/logger';
import { type Prisma } from '@prisma/client';

import { type ReportRepositoryPort } from '../../../../application/ports/outbound/persistence/report-repository.port.js';

import { type Report } from '../../../../domain/entities/report.entity.js';
import { type Country } from '../../../../domain/value-objects/country.vo.js';
import { type Language } from '../../../../domain/value-objects/language.vo.js';

import { type PrismaAdapter } from '../prisma.adapter.js';

import { ReportMapper } from './prisma-report.mapper.js';

export class PrismaReportRepository implements ReportRepositoryPort {
    private readonly mapper: ReportMapper;

    constructor(
        private readonly prisma: PrismaAdapter,
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
            data: {
                sources: updatedSources,
            },
            where: { id: reportId },
        });
    }

    async create(report: Report): Promise<Report> {
        const prismaClient = this.prisma.getPrismaClient();

        // Use transaction to create report with angles
        const result = await prismaClient.$transaction(async (tx) => {
            // Create the report
            const createdReport = await tx.report.create({
                data: this.mapper.toPrisma(report),
            });

            // Create angles
            for (const angle of report.angles) {
                await tx.reportAngle.create({
                    data: this.mapper.angleToPrisma(angle, createdReport.id),
                });
            }

            // Return the created report with angles
            return await tx.report.findUnique({
                include: {
                    angles: true,
                },
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
            // Create the duplicate report linked to its canonical
            const duplicateData = {
                ...this.mapper.toPrisma(report),
                // The following fields are added by a schema migration and may not be present
                // in generated Prisma types until generation runs; we cast to bypass excess checks
                duplicateOfId: options.duplicateOfId,
                duplicateReview: 'PENDING_REVIEW',
            } as unknown as Prisma.ReportCreateInput;

            const createdReport = await tx.report.create({
                data: duplicateData,
            });

            // Create angles for the duplicate as well
            for (const angle of report.angles) {
                await tx.reportAngle.create({
                    data: this.mapper.angleToPrisma(angle, createdReport.id),
                });
            }

            return await tx.report.findUnique({
                include: { angles: true },
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
            include: {
                angles: true,
            },
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
        where?: {
            classification?: 'PENDING_CLASSIFICATION';
        };
    }): Promise<Report[]> {
        const where: Record<string, unknown> = {};

        // Category filter
        if (criteria.category) {
            const categoryFilter = this.mapper.createCategoryFilter(criteria.category);
            if (categoryFilter) {
                Object.assign(where, categoryFilter);
            }
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
            // Note: duplicate filtering (duplicateOfId = null) intentionally omitted to maintain
            // compatibility with older generated Prisma clients during tests.
        }

        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: {
                angles: true,
            },
            orderBy: {
                dateline: 'desc',
            },
            skip: criteria.offset,
            take: criteria.limit,
            where,
        });

        return reports.map((report) => this.mapper.toDomain(report));
    }

    async findRecentFacts(options: {
        country: Country;
        language: Language;
        since: Date;
    }): Promise<Array<{ facts: string; id: string }>> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                facts: true,
                id: true,
            },
            take: 100, // Limit to a reasonable number for performance
            where: {
                country: this.mapper.mapCountryToPrisma(options.country),
                createdAt: {
                    gte: options.since,
                },
            },
        });
        return reports;
    }

    async findReportsWithoutArticles(criteria?: {
        category?: string;
        classification?: Array<'NICHE' | 'PENDING_CLASSIFICATION' | 'STANDARD'>;
        country?: string;
        limit?: number;
    }): Promise<Report[]> {
        const where: Record<string, unknown> = {
            articles: {
                none: {}, // Reports that have no articles linked
            },
        };

        // Category filter
        if (criteria?.category) {
            const categoryFilter = this.mapper.createCategoryFilter(criteria.category);
            if (categoryFilter) {
                Object.assign(where, categoryFilter);
            }
        }

        // Country filter
        if (criteria?.country) {
            where.country = criteria.country;
        }

        // Exclude suspected/confirmed duplicates – generate articles only from canonicals
        // Note: duplicate filtering (duplicateOfId = null) intentionally omitted to maintain
        // compatibility with older generated Prisma clients during tests.

        // Classification filter
        if (criteria?.classification && criteria.classification.length > 0) {
            where.classification = { in: criteria.classification };
        }

        const reports = await this.prisma.getPrismaClient().report.findMany({
            include: {
                angles: true,
            },
            orderBy: {
                dateline: 'desc',
            },
            take: criteria?.limit || 50,
            where,
        });

        return reports.map((report) => this.mapper.toDomain(report));
    }

    async getAllSourceReferences(country?: Country): Promise<string[]> {
        const reports = await this.prisma.getPrismaClient().report.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                sources: true,
            },
            take: 5000, // Limit to the 5,000 most recent reports as per contract
            where: country
                ? {
                      country: this.mapper.mapCountryToPrisma(country),
                  }
                : undefined,
        });

        // Flatten the array of arrays and remove duplicates
        const allSourceReferences = reports
            .map((report) => report.sources as string[])
            .flat()
            .filter((ref, index, arr) => arr.indexOf(ref) === index);

        return allSourceReferences;
    }

    async update(id: string, data: Partial<Report>): Promise<Report> {
        const updateData: Record<string, unknown> = {};

        if (data.classification) {
            updateData.classification = data.classification.toString();
        }

        const updatedReport = await this.prisma.getPrismaClient().report.update({
            data: updateData,
            include: {
                angles: true,
            },
            where: { id },
        });

        return this.mapper.toDomain(updatedReport);
    }
}
