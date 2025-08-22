/*
  Warnings:

  - You are about to drop the column `traitsSmart` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `traitsSmart` on the `Report` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "traitsEssential" BOOLEAN NOT NULL DEFAULT false,
    "traitsPositive" BOOLEAN NOT NULL DEFAULT false,
    "fabricated" BOOLEAN NOT NULL DEFAULT false,
    "fabricatedReason" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("body", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt", "traitsPositive") SELECT "body", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt", "traitsPositive" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "core" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "classificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "tier" TEXT,
    "traitsEssential" BOOLEAN NOT NULL DEFAULT false,
    "traitsPositive" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationState" TEXT NOT NULL DEFAULT 'PENDING',
    "duplicateOfId" TEXT,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("background", "classificationState", "core", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "tier", "traitsPositive", "updatedAt") SELECT "background", "classificationState", "core", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "tier", "traitsPositive", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_classificationState_idx" ON "Report"("classificationState");
CREATE INDEX "Report_deduplicationState_idx" ON "Report"("deduplicationState");
CREATE INDEX "Report_duplicateOfId_idx" ON "Report"("duplicateOfId");
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
