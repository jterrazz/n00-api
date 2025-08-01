import { type LoggerPort } from '@jterrazz/logger';
import { randomUUID } from 'crypto';

import { Report } from '../../../domain/entities/report.entity.js';
import { Categories } from '../../../domain/value-objects/categories.vo.js';
import { type Country } from '../../../domain/value-objects/country.vo.js';
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
            this.logger.info('Starting report ingestion', {
                country: country.toString(),
                language: language.toString(),
            });

            // Step 1: Get recent reports and existing source IDs for deduplication
            const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3); // 3 days ago
            const [recentReports, existingSourceReferences] = await Promise.all([
                this.reportRepository.findRecentFacts({ country, language, since }),
                this.reportRepository.getAllSourceReferences(country),
            ]);

            this.logger.info('Repository statistics', {
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
                this.logger.warn('No news reports fetched', {
                    country: country.toString(),
                    language: language.toString(),
                });
                return [];
            }
            this.logger.info('Fetched news reports', { count: newsStories.length });

            // Step 3: Filter out reports with insufficient articles (before considering duplicates)
            const maxArticleCount = Math.max(
                ...newsStories.map((report) => report.articles.length),
            );

            const articleThreshold = Math.ceil(maxArticleCount * 0.7);

            const articleFilteredReports = newsStories.filter(
                (report) =>
                    report.articles.length >= articleThreshold || report.articles.length > 3,
            );

            if (articleFilteredReports.length === 0) {
                this.logger.warn('No valid reports after article-count filtering');
                return [];
            }

            this.logger.info('Valid reports after article-count filtering', {
                articleThreshold,
                count: articleFilteredReports.length,
            });

            // Step 4: Filter out reports that have already been processed by source ID
            const newNewsReports = articleFilteredReports.filter(
                (report) =>
                    !report.articles.some((article) =>
                        existingSourceReferences.includes(article.id),
                    ),
            );

            if (newNewsReports.length === 0) {
                this.logger.info('No non-duplicate reports found');
                return [];
            }

            this.logger.info('Valid reports after deduplication', { count: newNewsReports.length });

            // Rename for clarity in the following processing steps
            const validNewsReports = newNewsReports;

            // Step 5: Process each valid news report
            const digestedReports: Report[] = [];
            // Track all reports for deduplication (existing + newly processed in this batch)
            const allReportsForDeduplication = [...recentReports];

            for (const newsReport of validNewsReports) {
                try {
                    // Step 5.1: Check for semantic duplicates only if we have something to compare against
                    if (allReportsForDeduplication.length > 0) {
                        const deduplicationResult = await this.reportDeduplicationAgent.run({
                            existingReports: allReportsForDeduplication,
                            newReport: newsReport,
                        });

                        if (deduplicationResult?.duplicateOfReportId) {
                            const existing = await this.reportRepository.findById(
                                deduplicationResult.duplicateOfReportId,
                            );

                            if (existing) {
                                this.logger.info('Report marked as duplicate', {
                                    duplicateOf: deduplicationResult.duplicateOfReportId,
                                });
                                await this.reportRepository.addSourceReferences(
                                    deduplicationResult.duplicateOfReportId,
                                    newsReport.articles.map((a) => a.id),
                                );
                                continue; // Skip to the next report
                            }

                            this.logger.warn('Duplicate report id not found in repository', {
                                duplicateOf: deduplicationResult.duplicateOfReportId,
                            });
                        }
                    }

                    // Step 5.2: Ingest the unique report
                    const ingestionResult = await this.reportIngestionAgent.run({ newsReport });
                    if (!ingestionResult) {
                        this.logger.warn('Ingestion agent returned no result', {
                            articleCount: newsReport.articles.length,
                        });
                        continue;
                    }

                    const reportId = randomUUID();
                    const now = new Date();
                    const angles = ingestionResult.angles.map(
                        (angle) =>
                            new ReportAngle({
                                angleCorpus: new AngleCorpus(angle.corpus),
                                stance: new Stance(angle.stance),
                            }),
                    );

                    const report = new Report({
                        angles,
                        categories: new Categories([ingestionResult.category.toString()]),
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
                    this.logger.info('Report ingested successfully', { reportId: savedReport.id });
                } catch (reportError) {
                    this.logger.warn('Error while processing individual report', {
                        error: reportError,
                    });
                }
            }

            return digestedReports;
        } catch (error) {
            this.logger.error('Report ingestion encountered an error', { error });
            throw error;
        }
    }
}
