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
    classificationSchema,
    type StoryClassificationAgentPort,
    type StoryClassificationInput,
    type StoryClassificationResult,
} from '../../../application/ports/outbound/agents/story-classification.agent.js';

import { Classification as ClassificationVO } from '../../../domain/value-objects/story/classification.vo.js';

export class StoryClassificationAgentAdapter implements StoryClassificationAgentPort {
    static readonly SCHEMA = z.object({
        classification: classificationSchema,
        reason: z
            .string()
            .describe('A brief, clear justification for your classification selection.'),
    });

    static readonly SYSTEM_PROMPT = new SystemPromptAdapter(
        'You are an expert Senior Editor for a modern digital news platform. Your primary responsibility is to classify stories to ensure quality, relevance, and proper placement within the app.',
        'You are discerning, have high standards, and understand what makes a story compelling for a broad audience versus a niche one.',
        PROMPT_LIBRARY.FOUNDATIONS.CONTEXTUAL_ONLY,
        PROMPT_LIBRARY.TONES.NEUTRAL,
    );

    public readonly name = 'StoryClassificationAgent';

    private readonly agent: BasicAgentAdapter<
        z.infer<typeof StoryClassificationAgentAdapter.SCHEMA>
    >;

    constructor(
        private readonly model: ModelPort,
        private readonly logger: LoggerPort,
    ) {
        this.agent = new BasicAgentAdapter(this.name, {
            logger: this.logger,
            model: this.model,
            schema: StoryClassificationAgentAdapter.SCHEMA,
            systemPrompt: StoryClassificationAgentAdapter.SYSTEM_PROMPT,
        });
    }

    static readonly USER_PROMPT = (input: StoryClassificationInput) => {
        const { story } = input;
        const storyData = {
            category: story.category.toString(),
            perspectives: story.perspectives?.map((p) => ({
                digest: p.perspectiveCorpus.value,
                discourse: p.tags.tags.discourse_type,
                stance: p.tags.tags.stance,
            })),
            synopsis: story.synopsis,
        };

        return new UserPromptAdapter(
            // Core Mission
            'You are a Senior Editor. Your role is to determine if a story has broad, general appeal, is suited for a niche audience, or should be archived entirely. Trust your editorial judgment to ensure our main feed is engaging for everyone, while still serving dedicated fans and filtering out irrelevant content.',
            '',

            // The Classifications - Your Guiding Principles
            'Use these principles to guide your decision:',
            '•   **STANDARD:** For stories with broad, mainstream appeal. This is for content that a general audience would find interesting or important. **Example:** a major championship final, a significant political election, or major international news.',
            '•   **NICHE:** For high-quality stories that primarily serve a specific community or interest group. Use this for content that is not of broad interest. **Example:** a regular-season match between less popular teams, specific celebrity news, or updates on a niche hobby.',
            '•   **ARCHIVED:** Use this for content that is not a report on a real-world event. This includes game guides (like Wordle answers/hints), listicles, promotional content, direct advertisements, or pure opinion pieces without a factual basis.',
            '',

            // Your Task
            "Your task is to weigh the story's topic against these principles and use your editorial 'feel' to assign the most appropriate classification. The primary factor is the story's audience and where it should be placed.",
            '',

            // Critical Rules
            'CRITICAL RULES:',
            '•   You **MUST** select one of the three classifications: `STANDARD`, `NICHE`, or `ARCHIVED`.',
            '•   You **MUST** provide a brief, clear `reason` justifying your editorial decision.',
            '',

            // Story to Analyze
            'STORY TO ANALYZE:',
            JSON.stringify(storyData, null, 2),
        );
    };

    async run(input: StoryClassificationInput): Promise<null | StoryClassificationResult> {
        try {
            this.logger.info(`[${this.name}] Classifying story...`, {
                storyId: input.story.id,
            });

            const result = await this.agent.run(StoryClassificationAgentAdapter.USER_PROMPT(input));

            if (!result) {
                this.logger.warn(`[${this.name}] Classification failed. No result from AI model.`, {
                    storyId: input.story.id,
                });
                return null;
            }

            this.logger.info(`[${this.name}] Story classified successfully.`, {
                classification: result.classification,
                reason: result.reason,
                storyId: input.story.id,
            });

            return {
                classification: new ClassificationVO(result.classification),
                reason: result.reason,
            };
        } catch (error) {
            this.logger.error(`[${this.name}] An error occurred during classification.`, {
                error,
                storyId: input.story.id,
            });
            return null;
        }
    }
}
