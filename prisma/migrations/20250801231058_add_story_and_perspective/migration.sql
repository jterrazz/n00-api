/*
  Warnings:

  - You are about to drop the column `category` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `fakeReason` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `fakeStatus` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `discourse` on the `ArticleFrame` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `discourse` on the `ReportAngle` table. All the data in the column will be lost.
  - Added the required column `categories` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categories` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "authenticity" TEXT NOT NULL DEFAULT 'AUTHENTIC',
    "clarification" TEXT,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("body", "country", "createdAt", "headline", "id", "language", "publishedAt") SELECT "body", "country", "createdAt", "headline", "id", "language", "publishedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_ArticleFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleFrame_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleFrame" ("articleId", "body", "createdAt", "headline", "id", "stance") SELECT "articleId", "body", "createdAt", "headline", "id", "stance" FROM "ArticleFrame";
DROP TABLE "ArticleFrame";
ALTER TABLE "new_ArticleFrame" RENAME TO "ArticleFrame";
CREATE INDEX "ArticleFrame_articleId_idx" ON "ArticleFrame"("articleId");
CREATE INDEX "ArticleFrame_stance_idx" ON "ArticleFrame"("stance");
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Report" ("classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt") SELECT "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE TABLE "new_ReportAngle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corpus" TEXT NOT NULL,
    "stance" TEXT,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportAngle_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportAngle" ("corpus", "createdAt", "id", "reportId", "stance", "updatedAt") SELECT "corpus", "createdAt", "id", "reportId", "stance", "updatedAt" FROM "ReportAngle";
DROP TABLE "ReportAngle";
ALTER TABLE "new_ReportAngle" RENAME TO "ReportAngle";
CREATE INDEX "ReportAngle_reportId_idx" ON "ReportAngle"("reportId");
CREATE INDEX "ReportAngle_stance_idx" ON "ReportAngle"("stance");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
