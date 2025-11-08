import { Hono } from 'hono';

import { type GetArticlesController } from './get-articles.controller.js';

export const createArticlesRouter = (getArticlesController: GetArticlesController) => {
    const app = new Hono();

    app.get('/', async (c) => {
        const query = c.req.query();
        const queries = c.req.queries();

        const response = await getArticlesController.getArticles({
            category: query.category,
            country: query.country,
            cursor: query.cursor,
            ids: (queries as unknown as Record<string, string[] | undefined>).ids,
            language: query.language,
            limit: query.limit,
        });

        return c.json(response);
    });

    return app;
};
