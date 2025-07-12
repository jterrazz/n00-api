import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Report } from '../../../domain/entities/report.entity.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
import { Discourse } from '../../../domain/value-objects/discourse.vo.js';
import { type Language } from '../../../domain/value-objects/language.vo.js';
import { Classification } from '../../../domain/value-objects/report/classification.vo.js';
import { AngleCorpus } from '../../../domain/value-objects/report-angle/angle-corpus.vo.js';
import { ReportAngle } from '../../../domain/value-objects/report-angle/report-angle.vo.js';
import { Stance } from '../../../domain/value-objects/stance.vo.js';

import { type ReportDeduplicationAgentPort } from '../../ports/outbound/agents/report-deduplication.agent.js';
import { type ReportIngestionAgentPort } from '../../ports/outbound/agents/report-ingestion.agent.js';
import { type ReportRepositoryPort } from '../../ports/outbound/persistence/report-repository.port.js';
import { type NewsProviderPort } from '../../ports/outbound/providers/news.port.js';

/**
 * Use case for digesting reports from news sources
 */
export class IngestReportsUseCase {
    constructor(
        private readonly reportIngestionAgent: ReportIngestionAgentPort,
        private readonly reportDeduplicationAgent: ReportDeduplicationAgentPort,
        private readonly logger: LoggerPort,
        private readonly newsProvider: NewsProviderPort,
        private readonly reportRepository: ReportRepositoryPort,
    ) {}

    /**
     * Digest reports for a specific language and country
     */
    public async execute(language: Language, country: Country): Promise<Report[]> {
        try {
            this.logger.info('report:ingest:start', {
                country: country.toString(),
                language: language.toString(),
            });

            // Step 1: Get recent reports and existing source IDs for deduplication
            const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3); // 3 days ago
            const [recentReports, existingSourceReferences] = await Promise.all([
                this.reportRepository.findRecentFacts({ country, language, since }),
                this.reportRepository.getAllSourceReferences(country),
            ]);

            this.logger.info('report:ingest:stats', {
                recentReports: recentReports.length,
                sourceReferences: existingSourceReferences.length,
            });

            // Step 2: Fetch news from external providers
            let newsStories = await this.newsProvider.fetchNews({
                country,
                language,
            });

            newsStories = newsStories.slice(0, 3);

            if (newsStories.length === 0) {
                this.logger.warn('report:ingest:news:none', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }
            this.logger.info('report:ingest:news:fetched', { count: newsStories.length });

            // Step 3: Filter out reports that have already been processed by source ID
            const newNewsReports = newsStories.filter(
                (report) =>
                    !report.articles.some((article) =>
                        existingSourceReferences.includes(article.id),
                    ),
            );

            if (newNewsReports.length === 0) {
                this.logger.info('report:ingest:duplicates:none');
                return [];
            }
            this.logger.info('report:ingest:duplicates:filtered', { count: newNewsReports.length });

            // Step 4: Filter out reports with insufficient articles
            const validNewsReports = newNewsReports.filter((report) => report.articles.length >= 2);

            if (validNewsReports.length === 0) {
                this.logger.warn('report:ingest:invalid:none');
                return [];
            }

            // Step 5: Process each valid news report
            const digestedReports: Report[] = [];
            // Track all reports for deduplication (existing + newly processed in this batch)
            const allReportsForDeduplication = [...recentReports];

            for (const newsReport of validNewsReports) {
                try {
                    // Step 5.1: Check for semantic duplicates (including newly processed reports)
                    const deduplicationResult = await this.reportDeduplicationAgent.run({
                        existingReports: allReportsForDeduplication,
                        newReport: newsReport,
                    });

                    if (deduplicationResult?.duplicateOfReportId) {
                        this.logger.info('report:deduplicated', {
                            duplicateOf: deduplicationResult.duplicateOfReportId,
                        });
                        await this.reportRepository.addSourceReferences(
                            deduplicationResult.duplicateOfReportId,
                            newsReport.articles.map((a) => a.id),
                        );
                        continue; // Skip to the next report
                    }

                    // End deduplication check

                    // Step 5.2: Ingest the unique report
                    const ingestionResult = await this.reportIngestionAgent.run({ newsReport });
                    if (!ingestionResult) {
                        this.logger.warn('report:ingest:agent-null', {
                            newsReportArticles: newsReport.articles.length,
                        });
                        continue;
                    }

                    const reportId = randomUUID();
                    const now = new Date();
                    const angles = ingestionResult.angles.map(
                        (angle) =>
                            new ReportAngle({
                                angleCorpus: new AngleCorpus(angle.corpus),
                                discourse: new Discourse(angle.discourse),
                                stance: new Stance(angle.stance),
                            }),
                    );

                    const report = new Report({
                        angles,
                        category: ingestionResult.category,
                        classification: new Classification('PENDING_CLASSIFICATION'),
                        country,
                        createdAt: now,
                        dateline: newsReport.publishedAt,
                        facts: ingestionResult.facts,
                        id: reportId,
                        sourceReferences: newsReport.articles.map((a) => a.id),
                        updatedAt: now,
                    });

                    const savedReport = await this.reportRepository.create(report);
                    digestedReports.push(savedReport);
                    // Add the newly created report to deduplication tracking for subsequent reports
                    allReportsForDeduplication.push(savedReport);
                    this.logger.info('report:ingest:ingested', { reportId: savedReport.id });
                } catch (reportError) {
                    this.logger.warn('report:ingest:report:error', {
                        error: reportError,
                    });
                }
            }

            return digestedReports;
        } catch (error) {
            this.logger.error('report:ingest:error', { error });
            throw error;
        }
    }
}
