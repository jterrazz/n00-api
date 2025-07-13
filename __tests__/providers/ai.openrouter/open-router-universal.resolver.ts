import { http, HttpResponse } from 'msw';

/**
 * Shared constants used by the OpenRouter mock handlers.
 */
const TEST_API_KEY = 'test-openrouter-key';

/**
 * Helper used to create an OpenRouter-style JSON chat completion.
 */
function buildCompletion(id: string, model: string, content: Record<string, unknown>) {
    return {
        choices: [
            {
                finish_reason: 'stop',
                index: 0,
                message: {
                    content: JSON.stringify(content),
                    role: 'assistant',
                },
            },
        ],
        id,
        model,
    };
}

/* -------------------------------------------------------------------------- */
/*                               Agent helpers                                */
/* -------------------------------------------------------------------------- */

function handleIngestion(model: string) {
    return HttpResponse.json(
        buildCompletion('mock-ingestion-id', model, {
            angles: [
                {
                    corpus: 'This is a comprehensive corpus detailing the angle of the event from a mainstream perspective. It includes every significant argument, all supporting evidence, relevant statistics, quotes from key stakeholders, contextual background, chronological sequence of events, and potential implications. The corpus is written in bullet-point style, free of narrative fluff, focusing purely on delivering factual information that a writer can later transform into prose. Nothing is omitted; every pertinent data point gleaned from the articles is captured here for completeness.',
                    discourse: 'MAINSTREAM',
                    stance: 'NEUTRAL',
                },
            ],
            category: 'TECHNOLOGY',
            facts: 'Verified facts about the event presented in a clear, objective manner.',
        }),
    );
}

let classificationCounter = -1;
const classificationCycle: Array<'ARCHIVED' | 'NICHE' | 'STANDARD'> = [
    'STANDARD',
    'NICHE',
    'ARCHIVED',
];

interface ChatMessage {
    content: string;
    role: 'assistant' | 'user';
}

interface MockOpenRouterRequest {
    messages: ChatMessage[];
    model: string;
}

function handleClassification(model: string) {
    classificationCounter = (classificationCounter + 1) % classificationCycle.length;
    const classification = classificationCycle[classificationCounter];

    return HttpResponse.json(
        buildCompletion('mock-classification-id', model, {
            classification,
            reason: `Reason for ${classification.toLowerCase()} classification`,
        }),
    );
}

function handleComposition(model: string) {
    return HttpResponse.json(
        buildCompletion('mock-composition-id', model, {
            body: 'Neutral summary of the core, undisputed facts of the event.',
            frames: [
                {
                    body: 'Perspective specific frame content for the angle.',
                    headline: 'Angle headline',
                },
            ],
            headline: 'Main headline for the article',
        }),
    );
}

/* -------------------------------------------------------------------------- */
/*                            Universal POST handler                           */
/* -------------------------------------------------------------------------- */

function handleDeduplication(model: string) {
    return HttpResponse.json(
        buildCompletion('mock-dedup-id', model, {
            duplicateOfReportId: null,
            reason: 'No duplicate found in existing reports',
        }),
    );
}
function handleFalsification(model: string) {
    return HttpResponse.json(
        buildCompletion('mock-fake-article-id', model, {
            body: 'Satirical article body exaggerating the discovery of unicorn fossil fuels capable of infinite clean energy, clearly fictional.',
            category: 'TECHNOLOGY',
            clarification: 'Unrealistic scientific claims with no evidence',
            headline: 'Scientists Harness Unicorn Fossil Fuel for Endless Clean Energy',
            insertAfterIndex: -1,
            tone: 'satirical',
        }),
    );
}

/**
 * Single MSW handler mocking every OpenRouter AI agent used in integration tests.
 * Route discrimination is done by analysing the (second) user prompt.
 */
export const openRouterUniversalResolver = http.post(
    'https://openrouter.ai/api/v1/chat/completions',
    async ({ request }) => {
        const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
        if (apiKey !== TEST_API_KEY) {
            return HttpResponse.json({ error: 'Invalid test API key' }, { status: 400 });
        }

        const body = (await request.json()) as MockOpenRouterRequest;
        if (!body.messages?.length) {
            return HttpResponse.json({ error: 'Missing messages' }, { status: 400 });
        }

        const userPrompt = body.messages.find((m) => m.role === 'user')?.content ?? '';
        const { model } = body;

        /* ----------------------------- Prompt routing ----------------------------- */

        if (
            userPrompt.startsWith('Analyze the following news articles') ||
            userPrompt.startsWith('Your mission is to transform the following news articles')
        ) {
            return handleIngestion(model);
        }

        if (
            userPrompt.includes('Senior Editor') ||
            userPrompt.startsWith('Your task is to weigh the report')
        ) {
            return handleClassification(model);
        }

        if (
            userPrompt.startsWith(
                'Your primary mission is to perform a sophisticated semantic comparison',
            ) ||
            userPrompt.startsWith('Perform a deep semantic comparison')
        ) {
            return handleDeduplication(model);
        }

        if (
            userPrompt.includes('fake news detection game') ||
            userPrompt.includes('fake-news-detection game') ||
            userPrompt.includes('entirely fake news article')
        ) {
            return handleFalsification(model);
        }

        if (
            userPrompt.startsWith('CRITICAL: Output MUST be in') ||
            userPrompt.startsWith('CRITICAL: All output MUST be')
        ) {
            return handleComposition(model);
        }

        /* ------------------------------ Fallback -------------------------------- */
        return HttpResponse.json({ error: 'Unhandled prompt in OpenRouter mock' }, { status: 200 });
    },
);
