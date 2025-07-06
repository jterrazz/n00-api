import {
    type Category as PrismaCategory,
    type Country as PrismaCountry,
    type Discourse as PrismaDiscourse,
    type Prisma,
    type Stance as PrismaStance,
    type Story as PrismaStory,
    type StoryPerspective as PrismaStoryPerspective,
} from '@prisma/client';

import { Story } from '../../../domain/entities/story.entity.js';
import { Category } from '../../../domain/value-objects/category.vo.js';
import { Country } from '../../../domain/value-objects/country.vo.js';
import { Classification } from '../../../domain/value-objects/story/classification.vo.js';
import { PerspectiveCorpus } from '../../../domain/value-objects/story/perspective/perspective-corpus.vo.js';
import { PerspectiveTags } from '../../../domain/value-objects/story/perspective/perspective-tags.vo.js';
import { StoryPerspective } from '../../../domain/value-objects/story/perspective/story-perspective.vo.js';

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
        perspective: StoryPerspective,
        storyId: string,
    ): Omit<PrismaStoryPerspective, 'createdAt' | 'id' | 'updatedAt'> {
        return {
            discourse: this.mapDiscourseToPrisma(perspective.tags.tags.discourse_type),
            holisticDigest: perspective.perspectiveCorpus.toString(),
            stance: this.mapStanceToPrisma(perspective.tags.tags.stance),
            storyId,
        };
    }

    toDomain(
        prisma: PrismaStory & {
            perspectives: PrismaStoryPerspective[];
        },
    ): Story {
        const perspectives = prisma.perspectives.map(
            (p) =>
                new StoryPerspective({
                    perspectiveCorpus: new PerspectiveCorpus(p.holisticDigest),
                    tags: new PerspectiveTags({
                        discourse_type: p.discourse as PrismaDiscourse,
                        stance: p.stance as PrismaStance,
                    }),
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
