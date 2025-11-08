/*
  Warnings:

  - You are about to drop the column `synopsis` on the `Story` table. All the data in the column will be lost.
  - Added the required column `facts` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Story" (
    "category",
    "classification",
    "country",
    "createdAt",
    "dateline",
    "facts",
    "id",
    "sourceReferences",
    "updatedAt"
) SELECT
    "category",
    "classification",
    "country",
    "createdAt",
    "dateline",
    COALESCE("synopsis", '') AS "facts",
    "id",
    "sourceReferences",
    "updatedAt"
FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_category_idx" ON "Story"("category");
CREATE INDEX "Story_country_idx" ON "Story"("country");
CREATE INDEX "Story_dateline_idx" ON "Story"("dateline");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
