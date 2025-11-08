/*
  Warnings:

  - You are about to drop the column `categories` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `traits` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `categories` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `traits` on the `Report` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ArticleCategory" (
    "articleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    PRIMARY KEY ("articleId", "category"),
    CONSTRAINT "ArticleCategory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportCategory" (
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    PRIMARY KEY ("reportId", "category"),
    CONSTRAINT "ReportCategory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "traitsSmart" BOOLEAN NOT NULL DEFAULT false,
    "traitsUplifting" BOOLEAN NOT NULL DEFAULT false,
    "fabricated" BOOLEAN NOT NULL DEFAULT false,
    "fabricatedReason" TEXT,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("body", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt") SELECT "body", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "traitsSmart" BOOLEAN NOT NULL DEFAULT false,
    "traitsUplifting" BOOLEAN NOT NULL DEFAULT false,
    "classificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "classification" TEXT,
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sources" JSONB NOT NULL,
    "deduplicationState" TEXT NOT NULL DEFAULT 'PENDING',
    "duplicateOfId" TEXT,
    "duplicateReview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt") SELECT "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_classificationState_idx" ON "Report"("classificationState");
CREATE INDEX "Report_deduplicationState_idx" ON "Report"("deduplicationState");
CREATE INDEX "Report_duplicateOfId_idx" ON "Report"("duplicateOfId");
CREATE INDEX "Report_duplicateReview_idx" ON "Report"("duplicateReview");
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArticleCategory_category_idx" ON "ArticleCategory"("category");

-- CreateIndex
CREATE INDEX "ReportCategory_category_idx" ON "ReportCategory"("category");
