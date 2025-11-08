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
                    narrative:
                        'This is a comprehensive narrative detailing the angle of the story from a mainstream perspective. It includes every significant argument, all supporting evidence, relevant statistics, quotes from key stakeholders, detailed analysis, chronological sequence of developments, and potential implications. The narrative presents a complete account from this viewpoint, focusing purely on delivering factual information that captures this perspective thoroughly. Nothing is omitted; every pertinent data point gleaned from the articles is captured here for completeness.',
                },
            ],
            background:
                'Supporting contextual information that helps understand the core story. This includes relevant history, key players, industry background, previous developments, and broader context that readers need to fully comprehend the situation.',
            categories: ['TECHNOLOGY'],
            core: 'The main story being reported - the primary development, subject, or narrative that this report is fundamentally about.',
            traits: {
                essential: true,
                positive: false,
            },
        }),
    );
}

let classificationCounter = -1;
const classificationCycle: Array<'GENERAL' | 'NICHE' | 'OFF_TOPIC'> = [
    'GENERAL',
    'NICHE',
    'OFF_TOPIC',
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
            traits: {
                essential: false,
                positive: false,
            },
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
    // Alternate between no-duplicate and duplicate of the first ingested report
    // to exercise duplicate persistence path in tests.
    const isDuplicate = Math.random() < 0.5;
    const payload = isDuplicate
        ? { duplicateOfReportId: 'existing-report-id', reason: 'Duplicate of existing report' }
        : { duplicateOfReportId: null, reason: 'No duplicate found in existing reports' };

    return HttpResponse.json(buildCompletion('mock-dedup-id', model, payload));
}
function handleFabrication(model: string) {
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

function handleQuizGeneration(model: string) {
    return HttpResponse.json(
        buildCompletion('mock-quiz-generation-id', model, {
            questions: [
                {
                    answers: [
                        'It helps readers test their understanding of the article',
                        'It provides instant solutions to all problems',
                        'It generates random trivia questions',
                        'It replaces the need to read the article',
                    ],
                    question: 'What is the primary purpose of quiz questions for news articles?',
                },
                {
                    answers: [
                        'A mix of factual recall and analytical thinking',
                        'Only basic yes/no questions',
                        'Questions requiring external knowledge',
                        'Only opinion-based questions',
                    ],
                    question: 'What types of questions should be included in an article quiz?',
                },
            ],
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
            userPrompt.includes('You are a senior news analyst') ||
            userPrompt.includes('transform multiple news articles covering the SAME event')
        ) {
            return handleIngestion(model);
        }

        if (
            userPrompt.includes('You are a seasoned Senior Editor') ||
            userPrompt.includes('evaluate each report and classify it')
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
            userPrompt.includes('You are a senior editorial simulator') ||
            userPrompt.includes('crafting convincing but completely fabricated news articles')
        ) {
            return handleFabrication(model);
        }

        if (
            userPrompt.includes('You are a senior editorial writer') ||
            userPrompt.includes('convert structured report data into compelling news packages')
        ) {
            return handleComposition(model);
        }

        if (
            userPrompt.includes('You are an expert quiz generator') ||
            userPrompt.includes('creating engaging, educational questions based on news articles')
        ) {
            return handleQuizGeneration(model);
        }

        /* ------------------------------ Fallback -------------------------------- */
        return HttpResponse.json({ error: 'Unhandled prompt in OpenRouter mock' }, { status: 200 });
    },
);
