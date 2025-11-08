/*
  Warnings:

  - Added the required column `attributes` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "authenticity" TEXT NOT NULL DEFAULT 'AUTHENTIC',
    "clarification" TEXT,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("authenticity", "body", "categories", "clarification", "country", "createdAt", "headline", "id", "language", "publishedAt") SELECT "authenticity", "body", "categories", "clarification", "country", "createdAt", "headline", "id", "language", "publishedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "classification" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Report" ("categories", "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt") SELECT "categories", "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
