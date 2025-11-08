/*
  Warnings:

  - You are about to drop the column `countries` on the `Story` table. All the data in the column will be lost.
  - Added the required column `country` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synopsis" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Insert data with transformed countries - extract first country from JSON array
INSERT INTO "new_Story" ("id", "synopsis", "category", "country", "dateline", "sourceReferences", "createdAt", "updatedAt") 
SELECT 
    "id", 
    "synopsis", 
    "category", 
    CASE 
        WHEN json_extract("countries", '$[0]') = 'global' THEN 'global'
        WHEN json_extract("countries", '$[0]') = 'us' THEN 'us'
        WHEN json_extract("countries", '$[0]') = 'fr' THEN 'fr'
        ELSE 'global'  -- fallback to global if unable to parse
    END as "country",
    "dateline", 
    "sourceReferences", 
    "createdAt", 
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
