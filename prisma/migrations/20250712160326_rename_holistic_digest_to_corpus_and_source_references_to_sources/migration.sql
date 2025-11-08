/*
  Warnings:

  - You are about to drop the column `sourceReferences` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `holisticDigest` on the `ReportAngle` table. All the data in the column will be lost.
  - Added the required column `sources` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `corpus` to the `ReportAngle` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facts" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'PENDING_CLASSIFICATION',
    "country" TEXT NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Report" ("category", "classification", "country", "createdAt", "dateline", "facts", "id", "updatedAt", "sources") SELECT "category", "classification", "country", "createdAt", "dateline", "facts", "id", "updatedAt", "sourceReferences" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_category_idx" ON "Report"("category");
CREATE INDEX "Report_country_idx" ON "Report"("country");
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE TABLE "new_ReportAngle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corpus" TEXT NOT NULL,
    "stance" TEXT,
    "discourse" TEXT,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportAngle_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportAngle" ("createdAt", "discourse", "id", "reportId", "stance", "updatedAt", "corpus") SELECT "createdAt", "discourse", "id", "reportId", "stance", "updatedAt", "holisticDigest" FROM "ReportAngle";
DROP TABLE "ReportAngle";
ALTER TABLE "new_ReportAngle" RENAME TO "ReportAngle";
CREATE INDEX "ReportAngle_reportId_idx" ON "ReportAngle"("reportId");
CREATE INDEX "ReportAngle_stance_idx" ON "ReportAngle"("stance");
CREATE INDEX "ReportAngle_discourse_idx" ON "ReportAngle"("discourse");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
