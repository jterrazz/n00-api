/*
  Warnings:

  - You are about to drop the column `quiz` on the `Article` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ArticleQuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "correctAnswerIndex" INTEGER NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleQuizQuestion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
INSERT INTO "new_Article" ("body", "categories", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt", "traits") SELECT "body", "categories", "country", "createdAt", "fabricated", "fabricatedReason", "headline", "id", "language", "publishedAt", "traits" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArticleQuizQuestion_articleId_idx" ON "ArticleQuizQuestion"("articleId");
