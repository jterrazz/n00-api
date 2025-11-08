/*
  Warnings:

  - You are about to drop the column `storyReferences` on the `Article` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StoryReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storyId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    CONSTRAINT "StoryReference_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryReference_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StoryReference_storyId_idx" ON "StoryReference"("storyId");

-- CreateIndex
CREATE INDEX "StoryReference_articleId_idx" ON "StoryReference"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryReference_storyId_articleId_key" ON "StoryReference"("storyId", "articleId");
