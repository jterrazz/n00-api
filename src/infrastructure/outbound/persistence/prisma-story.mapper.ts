import {
    type Category as PrismaCategory,
    type Country as PrismaCountry,
    type Discourse as PrismaDiscourse,
    type Perspective as PrismaPerspective,
    type Prisma,
    type Stance as PrismaStance,
    type Story as PrismaStory,
} from '@prisma/client';

import { Perspective } from '../../../domain/entities/perspective.entity.js';
import { Story } from '../../../domain/entities/story.entity.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { Country } from '../../../domain/value-objects/country.vo.js';
import { HolisticDigest } from '../../../domain/value-objects/perspective/holistic-digest.vo.js';
import { PerspectiveTags } from '../../../domain/value-objects/perspective/perspective-tags.vo.js';
import { Classification } from '../../../domain/value-objects/story/classification.vo.js';

export class StoryMapper {
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

    perspectiveToPrisma(
        perspective: Perspective,
    ): Omit<PrismaPerspective, 'createdAt' | 'updatedAt'> {
        return {
            discourse: this.mapDiscourseToPrisma(perspective.tags.tags.discourse_type),
            holisticDigest: perspective.holisticDigest.toString(),
            id: perspective.id,
            stance: this.mapStanceToPrisma(perspective.tags.tags.stance),
            storyId: perspective.storyId,
        };
    }

    toDomain(
        prisma: PrismaStory & {
            perspectives: PrismaPerspective[];
        },
    ): Story {
        const perspectives = prisma.perspectives.map(
            (p) =>
                new Perspective({
                    createdAt: p.createdAt,
                    holisticDigest: new HolisticDigest(p.holisticDigest),
                    id: p.id,
                    storyId: p.storyId,
                    tags: new PerspectiveTags({
                        discourse_type: p.discourse as PrismaDiscourse,
                        stance: p.stance as PrismaStance,
                    }),
                    updatedAt: p.updatedAt,
                }),
        );

        return new Story({
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
            id: prisma.id,
            perspectives,
            sourceReferences: Array.isArray(prisma.sourceReferences)
                ? (prisma.sourceReferences as string[])
                : [],
            synopsis: prisma.synopsis,
            updatedAt: prisma.updatedAt,
        });
    }

    toPrisma(story: Story): Prisma.StoryCreateInput {
        return {
            category: this.mapCategoryToPrisma(story.category),
            classification: story.classification.toString() as
                | 'ARCHIVED'
                | 'NICHE'
                | 'PENDING_CLASSIFICATION'
                | 'STANDARD',
            country: this.mapCountryToPrisma(story.country),
            dateline: story.dateline,
            id: story.id,
            sourceReferences: story.sourceReferences,
            synopsis: story.synopsis,
        };
    }
}
