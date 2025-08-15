/*
  Warnings:

  - You are about to drop the column `tierState` on the `Report` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "core" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "classificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "tier" TEXT,
    "traitsSmart" BOOLEAN NOT NULL DEFAULT false,
    "traitsUplifting" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationState" TEXT NOT NULL DEFAULT 'PENDING',
    "duplicateOfId" TEXT,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("background", "core", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "tier", "traitsSmart", "traitsUplifting", "updatedAt") SELECT "background", "core", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "tier", "traitsSmart", "traitsUplifting", "updatedAt" FROM "Report";
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
