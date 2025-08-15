/*
  Warnings:

  - You are about to drop the column `duplicateReview` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `facts` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `corpus` on the `ReportAngle` table. All the data in the column will be lost.
  - Added the required column `background` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `core` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `narrative` to the `ReportAngle` table without a default value. This is not possible if the table is not empty.

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
    "classification" TEXT,
    "traitsSmart" BOOLEAN NOT NULL DEFAULT false,
    "traitsUplifting" BOOLEAN NOT NULL DEFAULT false,
    "deduplicationState" TEXT NOT NULL DEFAULT 'PENDING',
    "duplicateOfId" TEXT,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("classification", "classificationState", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "traitsSmart", "traitsUplifting", "updatedAt") SELECT "classification", "classificationState", "country", "createdAt", "dateline", "deduplicationState", "duplicateOfId", "id", "sources", "traitsSmart", "traitsUplifting", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_classificationState_idx" ON "Report"("classificationState");
CREATE INDEX "Report_deduplicationState_idx" ON "Report"("deduplicationState");
CREATE INDEX "Report_duplicateOfId_idx" ON "Report"("duplicateOfId");
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE TABLE "new_ReportAngle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "narrative" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportAngle_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportAngle" ("createdAt", "id", "reportId", "updatedAt") SELECT "createdAt", "id", "reportId", "updatedAt" FROM "ReportAngle";
DROP TABLE "ReportAngle";
ALTER TABLE "new_ReportAngle" RENAME TO "ReportAngle";
CREATE INDEX "ReportAngle_reportId_idx" ON "ReportAngle"("reportId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
