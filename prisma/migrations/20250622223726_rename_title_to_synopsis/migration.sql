/*
  Warnings:

  - You are about to drop the column `title` on the `Story` table. All the data in the column will be lost.
  - Added the required column `synopsis` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synopsis" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Story" ("category", "countries", "createdAt", "dateline", "id", "sourceReferences", "synopsis", "updatedAt") SELECT "category", "countries", "createdAt", "dateline", "id", "sourceReferences", "title", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_category_idx" ON "Story"("category");
CREATE INDEX "Story_dateline_idx" ON "Story"("dateline");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
