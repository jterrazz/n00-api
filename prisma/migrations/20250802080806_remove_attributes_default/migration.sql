-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Report" ("attributes", "categories", "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt") SELECT "attributes", "categories", "classification", "country", "createdAt", "dateline", "facts", "id", "sources", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
