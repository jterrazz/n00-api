import { getDiscourse } from '../../../__mocks__/discourses.mock.js';
import { getStance } from '../../../__mocks__/stances.mock.js';
import { Corpus } from '../corpus.vo.js';
import { StoryPerspective } from '../story-perspective.vo.js';

export function mockStoryPerspectives(count: number): StoryPerspective[] {
    return Array.from(
        { length: count },
        (_, index) =>
            new StoryPerspective({
                discourse: getDiscourse(index),
                perspectiveCorpus: new Corpus(
                    `This is a detailed holistic digest for perspective ${index + 1}. It includes all arguments, facts, and evidence to satisfy VO validation length requirements and provide realistic test data for development purposes.`,
                ),
                stance: getStance(index + 1),
            }),
    );
}
