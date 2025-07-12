import {
    type Category as PrismaCategory,
    type Country as PrismaCountry,
    type Discourse as PrismaDiscourse,
    type Prisma,
    type Report as PrismaReport,
    type ReportAngle as PrismaReportAngle,
    type Stance as PrismaStance,
} from '@prisma/client';

import { Report } from '../../../domain/entities/report.entity.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { Classification } from '../../../domain/value-objects/report/classification.vo.js';
import { AngleCorpus } from '../../../domain/value-objects/report-angle/angle-corpus.vo.js';
import { ReportAngle } from '../../../domain/value-objects/report-angle/report-angle.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';

export class ReportMapper {
    angleToPrisma(
        angle: ReportAngle,
        reportId: string,
    ): Omit<PrismaReportAngle, 'createdAt' | 'id' | 'updatedAt'> {
        return {
            corpus: angle.angleCorpus.toString(),
            discourse: this.mapDiscourseToPrisma(angle.discourse.value),
            reportId,
            stance: this.mapStanceToPrisma(angle.stance.value),
        };
    }

    mapCategoryToPrisma(category: Category): PrismaCategory {
        return category.toString() as PrismaCategory;
    }

    mapCountryFromPrisma(country: PrismaCountry): Country {
        return new Country(country);
    }

    mapCountryToPrisma(country: Country): PrismaCountry {
        return country.toString() as PrismaCountry;
    }

    mapDiscourseToPrisma(discourse?: string): null | PrismaDiscourse {
        return discourse ? (discourse as PrismaDiscourse) : null;
    }

    mapStanceToPrisma(stance?: string): null | PrismaStance {
        return stance ? (stance as PrismaStance) : null;
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
                    discourse: new Discourse(a.discourse as PrismaDiscourse),
                    stance: new Stance(a.stance as PrismaStance),
                }),
        );

        return new Report({
            angles,
            category: new Category(prisma.category),
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
            updatedAt: prisma.updatedAt,
        });
    }

    toPrisma(report: Report): Prisma.ReportCreateInput {
        return {
            category: this.mapCategoryToPrisma(report.category),
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
        };
    }
}
