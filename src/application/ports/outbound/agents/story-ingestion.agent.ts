import { type Category } from '../../../../domain/value-objects/category.vo.js';
import { type PerspectiveCorpus } from '../../../../domain/value-objects/story/perspective/perspective-corpus.vo.js';
import { type PerspectiveTags } from '../../../../domain/value-objects/story/perspective/perspective-tags.vo.js';

import { type NewsStory } from '../providers/news.port.js';

/**
 * @description
 * Port for the Story Ingestion Agent that processes raw news articles
 * into structured story data with perspectives and synopsis
 */
export interface StoryIngestionAgentPort {
    run(params: { newsStory: NewsStory }): Promise<null | StoryIngestionResult>;
}

/**
 * @description
 * Result of story ingestion containing structured perspectives and synopsis
 */
export interface StoryIngestionResult {
    category: Category;
    perspectives: Array<{
        perspectiveCorpus: PerspectiveCorpus;
        tags: PerspectiveTags;
    }>;
    synopsis: string;
}
