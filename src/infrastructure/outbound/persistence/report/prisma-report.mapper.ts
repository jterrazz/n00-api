import {
    type Prisma,
    type Country as PrismaCountry,
    type Report as PrismaReport,
    type ReportAngle as PrismaReportAngle,
} from '../../../../generated/prisma/client.js';

// Domain
import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { AngleNarrative } from '../../../../domain/value-objects/report-angle/angle-narrative.vo.js';
import { ReportAngle } from '../../../../domain/value-objects/report-angle/report-angle.vo.js';
import { Background } from '../../../../domain/value-objects/report/background.vo.js';
import { Core } from '../../../../domain/value-objects/report/core.vo.js';
import { DeduplicationState } from '../../../../domain/value-objects/report/deduplication-state.vo.js';
import { ClassificationState } from '../../../../domain/value-objects/report/tier-state.vo.js';
import { Classification } from '../../../../domain/value-objects/report/tier.vo.js';

export class ReportMapper {
    angleToPrisma(
        angle: ReportAngle,
        reportId: string,
    ): Omit<PrismaReportAngle, 'createdAt' | 'id' | 'updatedAt'> {
        return {
            narrative: angle.narrative.toString(),
            reportId,
        };
    }

    /**
     * Creates a Prisma where condition for category filtering using join table
     */
    createCategoryFilter(category?: string, categories?: string[]): object | undefined {
        if (categories && categories.length > 0) {
            return {
                categories: {
                    some: {
                        category: { in: categories },
                    },
                },
            };
        }

        if (category) {
            return {
                categories: {
                    some: {
                        category,
                    },
                },
            };
        }

        return undefined;
    }

    mapCountryFromPrisma(country: PrismaCountry): Country {
        return new Country(country);
    }

    mapCountryToPrisma(country: Country): PrismaCountry {
        return country.toString() as PrismaCountry;
    }

    toDomain(
        prisma: PrismaReport & {
            angles: PrismaReportAngle[];
            categories?: Array<{ category: string }>;
        },
    ): Report {
        const angles = prisma.angles.map(
            (a) =>
                new ReportAngle({
                    narrative: new AngleNarrative(a.narrative),
                }),
        );

        return new Report({
            angles,
            background: new Background(prisma.background),
            categories: new Categories(
                Array.isArray(prisma.categories)
                    ? (prisma.categories.map((c) => c.category) as string[])
                    : [],
            ),
            tier: prisma.tier
                ? new Classification(prisma.tier as 'GENERAL' | 'NICHE' | 'OFF_TOPIC')
                : undefined,
            classificationState: new ClassificationState(
                prisma.classificationState as 'COMPLETE' | 'PENDING',
            ),
            core: new Core(prisma.core),
            country: new Country(prisma.country),
            createdAt: prisma.createdAt,
            dateline: prisma.dateline,
            deduplicationState: new DeduplicationState(
                prisma.deduplicationState as 'COMPLETE' | 'PENDING',
            ),
            id: prisma.id,
            sourceReferences: Array.isArray(prisma.sources) ? (prisma.sources as string[]) : [],
            traits: new ArticleTraits({
                essential:
                    (prisma as unknown as { traitsEssential?: boolean }).traitsEssential ?? false,
                positive:
                    (prisma as unknown as { traitsPositive?: boolean }).traitsPositive ?? false,
            }),
            updatedAt: prisma.updatedAt,
        });
    }

    toPrisma(report: Report): Prisma.ReportCreateInput {
        return {
            background: report.background.toString(),
            categories: {
                create: report.categories.toArray().map((c) => ({ category: c })),
            },
            tier: report.tier?.toString() as 'GENERAL' | 'NICHE' | 'OFF_TOPIC' | null,
            classificationState: report.classificationState.toString() as 'COMPLETE' | 'PENDING',
            core: report.core.toString(),
            country: this.mapCountryToPrisma(report.country),
            dateline: report.dateline,
            deduplicationState: report.deduplicationState.toString() as 'COMPLETE' | 'PENDING',
            id: report.id,
            sources: report.sourceReferences,
            // Removed JSON traits - using typed columns
            traitsEssential: report.traits?.essential ?? false,
            traitsPositive: report.traits?.positive ?? false,
        };
    }
}
