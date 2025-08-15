// Application
import { type GetArticlesUseCase } from '../../../../application/use-cases/articles/get-articles.use-case.js';

import {
    type GetArticlesHttpQuery,
    GetArticlesRequestHandler,
} from './get-articles-request.handler.js';
import { GetArticlesResponsePresenter } from './get-articles-response.presenter.js';

/**
 * Orchestrates HTTP request handling for get articles endpoint
 * Delegates request processing, use case execution, and response formatting
 */
export class GetArticlesController {
    private readonly requestHandler: GetArticlesRequestHandler;
    private readonly responsePresenter: GetArticlesResponsePresenter;

    constructor(private readonly getArticlesUseCase: GetArticlesUseCase) {
        this.requestHandler = new GetArticlesRequestHandler();
        this.responsePresenter = new GetArticlesResponsePresenter();
    }

    async getArticles(rawQuery: GetArticlesHttpQuery) {
        const validatedParams = this.requestHandler.handle(rawQuery);

        const result = await this.getArticlesUseCase.execute(validatedParams);

        return this.responsePresenter.present(result);
    }
}
