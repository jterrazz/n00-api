import {
    BasicAgentAdapter,
    type ModelPort,
    PROMPT_LIBRARY,
    SystemPromptAdapter,
    UserPromptAdapter,
} from '@jterrazz/intelligence';
import { type LoggerPort } from '@jterrazz/logger';
import { z } from 'zod/v4';

import {
    type StoryDeduplicationAgentPort,
    type StoryDeduplicationResult,
} from '../../../application/ports/outbound/agents/story-deduplication.agent.js';
import { type NewsStory } from '../../../application/ports/outbound/providers/news.port.js';

/**
 * @description
 * This is a placeholder implementation for the Story Deduplication Agent.
 * In a real application, this would connect to a language model to perform
 * semantic analysis. For now, it always returns 'not a duplicate'.
 */
export class StoryDeduplicationAgentAdapter implements StoryDeduplicationAgentPort {
    static readonly SCHEMA = z.object({
        duplicateOfStoryId: z
            .string()
            .nullable()
            .describe("The ID of the existing story if it's a duplicate, otherwise null."),
        reason: z.string().describe('A brief, clear justification for your decision.'),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        "You are an intelligent digital gatekeeper. Your job is to read a new, incoming news story and determine if it's describing the exact same core event as a story that already exists in our database.",
        'You prevent the system from creating redundant stories about the same event.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.TONES.NEUTRAL,
    );

    public readonly name = 'StoryDeduplicationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof StoryDeduplicationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: StoryDeduplicationAgentAdapter.SCHEMA,
            systemPrompt: StoryDeduplicationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: {
        existingStories: Array<{ id: string; synopsis: string }>;
        newStory: NewsStory;
    }) => {
        const { existingStories, newStory } = input;

        return new UserPromptAdapter(
            // Core Mission
            'Your primary mission is to perform a sophisticated semantic comparison to determine if a new story is a duplicate of an existing one. This is not a simple keyword search.',
            '',

            // The Logic
            '1.  First, understand the essence of the new story. Ask: "What is the single, fundamental event being reported here? Who did what, where, and when?"',
            '2.  Then, compare this core event to the synopses of the existing stories provided.',
            '3.  A story is a duplicate if it reports on the same fundamental event, even if the wording, headline, or source is different.',
            '',

            // Examples
            '•   **DUPLICATE:** A new story about "Team A defeating Team B in the championship final" is a duplicate of an existing story with the synopsis "The championship final concluded with Team A winning."',
            '•   **UNIQUE:** A new story about "a key player from Team A getting injured" is NOT a duplicate of the story about the final, even though it involves the same team. It is a different, separate event.',
            '',

            // Critical Safety Rule
            '**CRITICAL:** If you are not absolutely certain a story is a duplicate, classify it as unique. It is better to have a rare duplicate than to miss a new story. Default to `null` if in doubt.',
            '',

            // Your Task
            "Your task is to analyze the new story against the list of existing stories. Based on your semantic analysis, determine if it's a duplicate.",
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '•   If it is a duplicate, you **MUST** return the `id` of the existing story in the `duplicateOfStoryId` field.',
            '•   If it is a unique story, you **MUST** return `null` in the `duplicateOfStoryId` field.',
            '•   You **MUST** provide a brief, clear `reason` justifying your decision.',
            '',

            // Data to Analyze
            'EXISTING STORIES (ID and Synopsis):',
            JSON.stringify(existingStories, null, 2),
            '',
            'NEW STORY (Full Content):',
            JSON.stringify(newStory, null, 2),
        );
    };

    async run(params: {
        existingStories: Array<{ id: string; synopsis: string }>;
        newStory: NewsStory;
    }): Promise<null | StoryDeduplicationResult> {
        try {
            this.logger.info(`[${this.name}] Checking for story duplicates...`, {
                newStoryTitle: params.newStory.articles[0]?.headline,
            });

            const result = await this.agent.run(StoryDeduplicationAgentAdapter.USER_PROMPT(params));

            if (!result) {
                this.logger.warn(
                    `[${this.name}] Deduplication check failed. No result from AI model.`,
                    {
                        newStoryTitle: params.newStory.articles[0]?.headline,
                    },
                );
                return null;
            }

            this.logger.info(`[${this.name}] Deduplication check complete.`, {
                duplicateOfStoryId: result.duplicateOfStoryId,
                newStoryTitle: params.newStory.articles[0]?.headline,
                reason: result.reason,
            });

            return {
                duplicateOfStoryId: result.duplicateOfStoryId,
            };
        } catch (error) {
            this.logger.error(`[${this.name}] An error occurred during deduplication check.`, {
                error,
                newStoryTitle: params.newStory.articles[0]?.headline,
            });
            return null;
        }
    }
}
