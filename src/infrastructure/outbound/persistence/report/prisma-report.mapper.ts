import {
    type Country as PrismaCountry,
    type Prisma,
    type Report as PrismaReport,
    type ReportAngle as PrismaReportAngle,
} from '@prisma/client';

import { Report } from '../../../../domain/entities/report.entity.js';
import { ArticleTraits } from '../../../../domain/value-objects/article-traits.vo.js';
import { Categories } from '../../../../domain/value-objects/categories.vo.js';
import { Country } from '../../../../domain/value-objects/country.vo.js';
import { Classification } from '../../../../domain/value-objects/report/classification.vo.js';
import { AngleCorpus } from '../../../../domain/value-objects/report-angle/angle-corpus.vo.js';
import { ReportAngle } from '../../../../domain/value-objects/report-angle/report-angle.vo.js';

export class ReportMapper {
    angleToPrisma(
        angle: ReportAngle,
        reportId: string,
    ): Omit<PrismaReportAngle, 'createdAt' | 'id' | 'updatedAt'> {
        return {
            corpus: angle.angleCorpus.toString(),
            reportId,
        };
    }

    /**
     * Creates a Prisma where condition for category filtering using JSON array operations
     */
    createCategoryFilter(category?: string, categories?: string[]): object | undefined {
        if (categories) {
            // Filter reports that contain ANY of the specified categories
            return {
                categories: {
                    array_contains: categories,
                },
            };
        }

        if (category) {
            // Filter reports that contain the specific category
            return {
                categories: {
                    array_contains: [category],
                },
            };
        }

        return undefined;
    }

    mapCategoriesToPrisma(categories: Categories): string[] {
        return categories.toArray();
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
        },
    ): Report {
        const angles = prisma.angles.map(
            (a) =>
                new ReportAngle({
                    angleCorpus: new AngleCorpus(a.corpus),
                }),
        );

        return new Report({
            angles,
            categories: new Categories(
                Array.isArray(prisma.categories) ? (prisma.categories as string[]) : [],
            ),
            classification: new Classification(
                prisma.classification as
                    | 'ARCHIVED'
                    | 'NICHE'
                    | 'PENDING_CLASSIFICATION'
                    | 'STANDARD',
            ),
            country: new Country(prisma.country),
            createdAt: prisma.createdAt,
            dateline: prisma.dateline,
            facts: prisma.facts,
            id: prisma.id,
            sourceReferences: Array.isArray(prisma.sources) ? (prisma.sources as string[]) : [],
            traits: ArticleTraits.fromJSON(prisma.traits || {}),
            updatedAt: prisma.updatedAt,
        });
    }

    toPrisma(report: Report): Prisma.ReportCreateInput {
        return {
            categories: this.mapCategoriesToPrisma(report.categories),
            classification: report.classification.toString() as
                | 'ARCHIVED'
                | 'NICHE'
                | 'PENDING_CLASSIFICATION'
                | 'STANDARD',
            country: this.mapCountryToPrisma(report.country),
            dateline: report.dateline,
            facts: report.facts,
            id: report.id,
            sources: report.sourceReferences,
            traits: report.traits?.toJSON() || { smart: false, uplifting: false },
        };
    }
}
