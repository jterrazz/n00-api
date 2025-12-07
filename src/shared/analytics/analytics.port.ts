/**
 * Properties that can be attached to analytics events
 */
export type AnalyticsProperties = Record<string, unknown>;

/**
 * User traits for identification
 */
export type AnalyticsTraits = Record<string, unknown>;

/**
 * Analytics port for product analytics and user behavior tracking
 * @description Abstracts product analytics for any backend (Mixpanel, Amplitude, PostHog, etc.)
 */
export interface AnalyticsPort {
    /**
     * Track a user action or event
     * @param event - Event name (e.g., "Button Clicked", "Purchase Completed")
     * @param properties - Optional event properties
     */
    track(event: string, properties?: AnalyticsProperties): void;

    /**
     * Identify a user with traits
     * @param userId - Unique user identifier
     * @param traits - Optional user traits (email, plan, etc.)
     */
    identify(userId: string, traits?: AnalyticsTraits): void;

    /**
     * Track a page or screen view
     * @param name - Page/screen name
     * @param properties - Optional page properties
     */
    page(name: string, properties?: AnalyticsProperties): void;

    /**
     * Associate user with a group or company (for B2B analytics)
     * @param groupId - Group/company identifier
     * @param traits - Optional group traits
     */
    group(groupId: string, traits?: AnalyticsTraits): void;

    /**
     * Reset user identity (call on logout)
     */
    reset(): void;
}
