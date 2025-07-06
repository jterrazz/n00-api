-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synopsis" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "interestTier" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Story" ("category", "country", "createdAt", "dateline", "id", "interestTier", "sourceReferences", "synopsis", "updatedAt") SELECT "category", "country", "createdAt", "dateline", "id", "interestTier", "sourceReferences", "synopsis", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_category_idx" ON "Story"("category");
CREATE INDEX "Story_country_idx" ON "Story"("country");
CREATE INDEX "Story_dateline_idx" ON "Story"("dateline");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
