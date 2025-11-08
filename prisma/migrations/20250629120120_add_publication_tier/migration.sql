/*
  Warnings:

  - You are about to drop the column `publicationTier` on the `Article` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fakeStatus" BOOLEAN NOT NULL,
    "fakeReason" TEXT,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("body", "category", "country", "createdAt", "fakeReason", "fakeStatus", "headline", "id", "language", "publishedAt") SELECT "body", "category", "country", "createdAt", "fakeReason", "fakeStatus", "headline", "id", "language", "publishedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synopsis" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "interestTier" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Story" ("category", "country", "createdAt", "dateline", "id", "sourceReferences", "synopsis", "updatedAt") SELECT "category", "country", "createdAt", "dateline", "id", "sourceReferences", "synopsis", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_category_idx" ON "Story"("category");
CREATE INDEX "Story_country_idx" ON "Story"("country");
CREATE INDEX "Story_dateline_idx" ON "Story"("dateline");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
