/*
  Warnings:

  - You are about to drop the column `authenticity` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `clarification` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `stance` on the `ArticleFrame` table. All the data in the column will be lost.
  - You are about to drop the column `stance` on the `ReportAngle` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "traits" JSONB NOT NULL,
    "fabricated" BOOLEAN NOT NULL DEFAULT false,
    "fabricatedReason" TEXT,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("body", "categories", "country", "createdAt", "headline", "id", "language", "publishedAt", "traits") SELECT "body", "categories", "country", "createdAt", "headline", "id", "language", "publishedAt", "traits" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_ArticleFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleFrame_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleFrame" ("articleId", "body", "createdAt", "headline", "id") SELECT "articleId", "body", "createdAt", "headline", "id" FROM "ArticleFrame";
DROP TABLE "ArticleFrame";
ALTER TABLE "new_ArticleFrame" RENAME TO "ArticleFrame";
CREATE INDEX "ArticleFrame_articleId_idx" ON "ArticleFrame"("articleId");
CREATE TABLE "new_ReportAngle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corpus" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportAngle_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportAngle" ("corpus", "createdAt", "id", "reportId", "updatedAt") SELECT "corpus", "createdAt", "id", "reportId", "updatedAt" FROM "ReportAngle";
DROP TABLE "ReportAngle";
ALTER TABLE "new_ReportAngle" RENAME TO "ReportAngle";
CREATE INDEX "ReportAngle_reportId_idx" ON "ReportAngle"("reportId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
