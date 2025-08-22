import {
    type Prisma,
    type PrismaClient,
    type Country as PrismaCountry,
    type Language as PrismaLanguage,
} from '@prisma/client';
import { addDays, subDays } from 'date-fns';

// Domain
import { Article } from '../../src/domain/entities/article.entity.js';
import { ArticleTraits } from '../../src/domain/value-objects/article-traits.vo.js';
import {
    Authenticity,
    AuthenticityStatusEnum,
} from '../../src/domain/value-objects/article/authenticity.vo.js';
import { Body } from '../../src/domain/value-objects/article/body.vo.js';
import { Headline } from '../../src/domain/value-objects/article/headline.vo.js';
import { Categories } from '../../src/domain/value-objects/categories.vo.js';
import { Country } from '../../src/domain/value-objects/country.vo.js';
import { Language } from '../../src/domain/value-objects/language.vo.js';

/**
 * Article test data builder using the Factory pattern
 * Provides fluent API for creating test articles with domain entities
 */
export class ArticleFactory {
    private readonly data: {
        authenticity: Authenticity;
        body: Body;
        categories: Categories;
        country: Country;
        headline: Headline;
        id: string;
        language: Language;
        publishedAt: Date;
        traits: ArticleTraits;
    };

    constructor() {
        this.data = {
            authenticity: new Authenticity(AuthenticityStatusEnum.AUTHENTIC),
            body: new Body('Default test article body with detailed information about the topic.'),
            categories: new Categories(['TECHNOLOGY']),
            country: new Country('US'),
            headline: new Headline('Default Test Article'),
            id: crypto.randomUUID(),
            language: new Language('EN'),
            publishedAt: new Date('2024-03-01T12:00:00.000Z'),
            traits: new ArticleTraits(),
        };
    }

    /** Marks the article as fabricated for testing scenarios. */
    public asFabricated(reason?: string): ArticleFactory {
        this.data.authenticity = new Authenticity(AuthenticityStatusEnum.FABRICATED, reason);
        return this;
    }

    /**
     * @deprecated Use {@link asFabricated} instead. Kept for compatibility with non-root tests.
     */

    public asFake(reason?: string): ArticleFactory {
        return this.asFabricated(reason);
    }

    /**
     * Builds an in-memory Article domain entity.
     * Prefer {@link createInDatabase} when persistence is required.
     */
    public build(): Article {
        return new Article({
            authenticity: this.data.authenticity,
            body: this.data.body,
            categories: this.data.categories,
            country: this.data.country,
            headline: this.data.headline,
            id: this.data.id,
            language: this.data.language,
            publishedAt: this.data.publishedAt,
            traits: this.data.traits,
        });
    }

    /** Persists the built article (and a linked report) to the database. */
    public async createInDatabase(prisma: PrismaClient): Promise<Article> {
        const article = this.build();

        // A minimal linked report is required by the API contract.
        const report = await prisma.report.create({
            data: {
                background: `Background context for ${article.headline.value}`,
                categories: {
                    create: article.categories.toArray().map((c) => ({ category: c })),
                },
                core: `Core story for ${article.headline.value}`,
                country: article.country.toString() as PrismaCountry,
                dateline: article.publishedAt,
                sources: [],
                tier: 'GENERAL',
                traitsEssential: article.traits.essential,
                traitsPositive: article.traits.positive,
            },
        });

        await prisma.article.create({
            data: {
                body: article.body.value,
                categories: {
                    create: article.categories.toArray().map((c) => ({ category: c })),
                },
                country: article.country.toString() as PrismaCountry,
                createdAt: article.publishedAt,
                fabricated: article.isFabricated(),
                fabricatedReason: article.authenticity.clarification,
                headline: article.headline.value,
                id: article.id,
                language: article.language.toString() as PrismaLanguage,
                publishedAt: article.publishedAt,
                reports: {
                    connect: { id: report.id },
                },
                traitsEssential: article.traits.essential,
                traitsPositive: article.traits.positive,
            } as unknown as Prisma.ArticleCreateInput,
        });

        return article;
    }

    // ----------------- Fluent setters used by integration tests -----------------

    public withBody(body: string): ArticleFactory {
        this.data.body = new Body(body);
        return this;
    }

    public withCountry(country: Country | string): ArticleFactory {
        this.data.country = typeof country === 'string' ? new Country(country) : country;
        return this;
    }

    public withHeadline(headline: string): ArticleFactory {
        this.data.headline = new Headline(headline);
        return this;
    }

    public withId(id: string): ArticleFactory {
        this.data.id = id;
        return this;
    }

    public withLanguage(language: Language | string): ArticleFactory {
        this.data.language = typeof language === 'string' ? new Language(language) : language;
        return this;
    }

    public withPublishedAt(date: Date): ArticleFactory {
        this.data.publishedAt = date;
        return this;
    }
}

/**
 * Common test scenarios for articles with predefined configurations
 * Provides ready-to-use article combinations for testing
 */
export class ArticleTestScenarios {
    /**
     * Seeds a single fabricated US article for the “Invented Event Shocks World” case.
     * Meant to be called in addition to {@link createMixedArticles} for modularity.
     */
    static async createFabricatedInventedEventArticle(prisma: PrismaClient): Promise<void> {
        const bodyWithMarkers =
            'Breaking %%[(FABRICATED)]( sensational )%% news about an invented event.';

        await new ArticleFactory()
            .withHeadline('Invented Event Shocks World')
            .withBody(bodyWithMarkers)
            .withCountry('US')
            .withLanguage('EN')
            .withPublishedAt(new Date('2024-03-03T12:00:00.000Z'))
            .asFabricated('Fabricated story')
            .createInDatabase(prisma);
    }

    /** Seeds the DB with a small set of authentic articles in
     * different languages/countries to exercise pagination & grouping logic.
     */
    static async createMixedArticles(prisma: PrismaClient): Promise<void> {
        const baseDate = new Date('2024-03-01T12:00:00.000Z');

        await Promise.all([
            // US articles (authentic)
            new ArticleFactory()
                .withCountry('US')
                .withLanguage('EN')
                .withId('11111111-1111-4111-8111-111111111111')
                .withPublishedAt(subDays(baseDate, 1))
                .createInDatabase(prisma),
            new ArticleFactory()
                .withCountry('US')
                .withLanguage('EN')
                .withId('22222222-2222-4222-8222-222222222222')
                .withPublishedAt(baseDate)
                .createInDatabase(prisma),

            // French article (authentic)
            new ArticleFactory()
                .withCountry('FR')
                .withLanguage('FR')
                .withId('33333333-3333-4333-8333-333333333333')
                .withPublishedAt(addDays(baseDate, 1))
                .createInDatabase(prisma),
        ]);
    }
}
