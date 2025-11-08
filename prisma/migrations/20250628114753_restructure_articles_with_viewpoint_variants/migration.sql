/*
  Warnings:

  - You are about to drop the `PerspectiveTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `article` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `isFake` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `Article` table. All the data in the column will be lost.
  - Added the required column `body` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fakeStatus` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publishedAt` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PerspectiveTag_discourseType_idx";

-- DropIndex
DROP INDEX "PerspectiveTag_stance_idx";

-- DropIndex
DROP INDEX "PerspectiveTag_perspectiveId_key";

-- AlterTable
ALTER TABLE "Perspective" ADD COLUMN "discourse" TEXT;
ALTER TABLE "Perspective" ADD COLUMN "stance" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PerspectiveTag";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ArticleVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "discourse" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleVariant_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
INSERT INTO "new_Article" ("category", "country", "createdAt", "fakeReason", "headline", "id", "language") SELECT "category", "country", "createdAt", "fakeReason", "headline", "id", "language" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_language_country_idx" ON "Article"("language", "country");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArticleVariant_articleId_idx" ON "ArticleVariant"("articleId");

-- CreateIndex
CREATE INDEX "ArticleVariant_stance_idx" ON "ArticleVariant"("stance");

-- CreateIndex
CREATE INDEX "ArticleVariant_discourse_idx" ON "ArticleVariant"("discourse");

-- CreateIndex
CREATE INDEX "Perspective_stance_idx" ON "Perspective"("stance");

-- CreateIndex
CREATE INDEX "Perspective_discourse_idx" ON "Perspective"("discourse");
