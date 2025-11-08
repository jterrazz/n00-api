import { z } from 'zod/v4';

export const categorySchema = z
    .enum([
        // World
        'WORLD',
        'WORLD_INTERNATIONAL_AFFAIRS',
        'WORLD_GLOBAL_ECONOMY',
        'WORLD_CONFLICTS_WARS',
        'WORLD_DIPLOMACY',
        'WORLD_HUMAN_RIGHTS',
        'WORLD_MIGRATION_REFUGEES',
        'WORLD_CLIMATE_CHANGE_GLOBAL',
        'WORLD_PANDEMICS_GLOBAL_HEALTH',

        // Politics
        'POLITICS',
        'POLITICS_ELECTIONS_CAMPAIGNS',
        'POLITICS_GOVERNMENT_POLICIES',
        'POLITICS_POLITICAL_SCANDALS',
        'POLITICS_LEGISLATION_LAWS',
        'POLITICS_INTERNATIONAL_RELATIONS',
        'POLITICS_POLITICAL_PARTIES',
        'POLITICS_ACTIVISM_PROTESTS',
        'POLITICS_CORRUPTION',
        'POLITICS_LEADERSHIP_CHANGES',

        // Business
        'BUSINESS',
        'BUSINESS_MARKETS_STOCKS',
        'BUSINESS_CORPORATE_NEWS',
        'BUSINESS_ECONOMY_FINANCE',
        'BUSINESS_STARTUPS_ENTREPRENEURSHIP',
        'BUSINESS_MERGERS_ACQUISITIONS',
        'BUSINESS_REAL_ESTATE',
        'BUSINESS_COMMODITIES',
        'BUSINESS_TRADE_TARIFFS',
        'BUSINESS_LABOR_EMPLOYMENT',
        'BUSINESS_CRYPTOCURRENCY_BLOCKCHAIN',

        // Technology
        'TECHNOLOGY',
        'TECHNOLOGY_GADGETS_DEVICES',
        'TECHNOLOGY_SOFTWARE_APPS',
        'TECHNOLOGY_AI_MACHINE_LEARNING',
        'TECHNOLOGY_CYBERSECURITY',
        'TECHNOLOGY_INTERNET_SOCIAL_MEDIA',
        'TECHNOLOGY_INNOVATION_RESEARCH',
        'TECHNOLOGY_BIG_TECH_COMPANIES',
        'TECHNOLOGY_DATA_PRIVACY',
        'TECHNOLOGY_EMERGING_TECH',
        'TECHNOLOGY_TELECOM_NETWORKS',

        // Science
        'SCIENCE',
        'SCIENCE_SPACE_EXPLORATION',
        'SCIENCE_ENVIRONMENT_ECOLOGY',
        'SCIENCE_BIOLOGY_GENETICS',
        'SCIENCE_PHYSICS_ASTRONOMY',
        'SCIENCE_CHEMISTRY_MATERIALS',
        'SCIENCE_EARTH_SCIENCES',
        'SCIENCE_MEDICAL_RESEARCH',
        'SCIENCE_CLIMATE_SCIENCE',
        'SCIENCE_ARCHAEOLOGY_PALEONTOLOGY',
        'SCIENCE_ENERGY_RENEWABLES',

        // Health
        'HEALTH',
        'HEALTH_WELLNESS_FITNESS',
        'HEALTH_MENTAL_HEALTH',
        'HEALTH_NUTRITION_DIET',
        'HEALTH_DISEASES_CONDITIONS',
        'HEALTH_HEALTHCARE_SYSTEMS',
        'HEALTH_VACCINES_IMMUNOLOGY',
        'HEALTH_PUBLIC_HEALTH',
        'HEALTH_AGING_LONGEVITY',
        'HEALTH_ALTERNATIVE_MEDICINE',
        'HEALTH_PANDEMICS_OUTBREAKS',

        // Entertainment
        'ENTERTAINMENT',
        'ENTERTAINMENT_MOVIES_TV',
        'ENTERTAINMENT_MUSIC',
        'ENTERTAINMENT_CELEBRITIES',
        'ENTERTAINMENT_BOOKS_LITERATURE',
        'ENTERTAINMENT_GAMING',
        'ENTERTAINMENT_ARTS_THEATER',
        'ENTERTAINMENT_FASHION',
        'ENTERTAINMENT_AWARDS_EVENTS',
        'ENTERTAINMENT_STREAMING_SERVICES',
        'ENTERTAINMENT_POP_CULTURE',

        // Sports
        'SPORTS',
        'SPORTS_FOOTBALL_SOCCER',
        'SPORTS_AMERICAN_FOOTBALL',
        'SPORTS_BASKETBALL',
        'SPORTS_TENNIS',
        'SPORTS_CRICKET',
        'SPORTS_GOLF',
        'SPORTS_OLYMPICS_PARALYMPICS',
        'SPORTS_MOTORSPORTS',
        'SPORTS_ATHLETICS_TRACK',
        'SPORTS_ESPORTS',
        'SPORTS_EXTREME_SPORTS',
        'SPORTS_TEAM_SPORTS_GENERAL',
        'SPORTS_INDIVIDUAL_SPORTS_GENERAL',

        // Lifestyle
        'LIFESTYLE',
        'LIFESTYLE_TRAVEL_TOURISM',
        'LIFESTYLE_FOOD_RECIPES',
        'LIFESTYLE_HOME_GARDENING',
        'LIFESTYLE_RELATIONSHIPS_FAMILY',
        'LIFESTYLE_PERSONAL_FINANCE',
        'LIFESTYLE_EDUCATION',
        'LIFESTYLE_CAREER_WORK',
        'LIFESTYLE_HOBBIES_LEISURE',
        'LIFESTYLE_SUSTAINABILITY_LIVING',
        'LIFESTYLE_PETS_ANIMALS',

        // Opinion
        'OPINION',
        'OPINION_EDITORIALS',
        'OPINION_COLUMNS',
        'OPINION_OP_EDS',
        'OPINION_ANALYSIS',
        'OPINION_COMMENTARIES',
        'OPINION_LETTERS_TO_EDITOR',

        // Environment
        'ENVIRONMENT',
        'ENVIRONMENT_CLIMATE_CHANGE',
        'ENVIRONMENT_CONSERVATION',
        'ENVIRONMENT_WILDLIFE',
        'ENVIRONMENT_POLLUTION',
        'ENVIRONMENT_NATURAL_DISASTERS',
        'ENVIRONMENT_SUSTAINABLE_PRACTICES',
        'ENVIRONMENT_GREEN_ENERGY',
        'ENVIRONMENT_BIODIVERSITY',
        'ENVIRONMENT_OCEAN_MARINE_LIFE',

        // Fallback
        'OTHER',
    ])
    .describe('Classifies the news report by topic or subject matter.');

export type CategoryEnum = z.infer<typeof categorySchema>;

export class Category {
    public readonly value: CategoryEnum;

    constructor(category: string) {
        const normalizedCategory = category.toUpperCase();
        const result = categorySchema.safeParse(normalizedCategory);

        if (!result.success) {
            this.value = 'OTHER';
        } else {
            this.value = result.data;
        }
    }

    public toString(): CategoryEnum {
        return this.value;
    }
}
