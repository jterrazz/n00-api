/*
  Warnings:

  - You are about to drop the `_StoryArticles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_StoryArticles";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "_ReportArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ReportArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ReportArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ReportArticles_AB_unique" ON "_ReportArticles"("A", "B");

-- CreateIndex
CREATE INDEX "_ReportArticles_B_index" ON "_ReportArticles"("B");

-- RedefineIndex
DROP INDEX "ArticleVariant_discourse_idx";
CREATE INDEX "ArticleFrame_discourse_idx" ON "ArticleFrame"("discourse");

-- RedefineIndex
DROP INDEX "ArticleVariant_stance_idx";
CREATE INDEX "ArticleFrame_stance_idx" ON "ArticleFrame"("stance");

-- RedefineIndex
DROP INDEX "ArticleVariant_articleId_idx";
CREATE INDEX "ArticleFrame_articleId_idx" ON "ArticleFrame"("articleId");

-- RedefineIndex
DROP INDEX "Story_createdAt_idx";
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- RedefineIndex
DROP INDEX "Story_dateline_idx";
CREATE INDEX "Report_dateline_idx" ON "Report"("dateline");

-- RedefineIndex
DROP INDEX "Story_country_idx";
CREATE INDEX "Report_country_idx" ON "Report"("country");

-- RedefineIndex
DROP INDEX "Story_category_idx";
CREATE INDEX "Report_category_idx" ON "Report"("category");

-- RedefineIndex
DROP INDEX "StoryPerspective_discourse_idx";
CREATE INDEX "ReportAngle_discourse_idx" ON "ReportAngle"("discourse");

-- RedefineIndex
DROP INDEX "StoryPerspective_stance_idx";
CREATE INDEX "ReportAngle_stance_idx" ON "ReportAngle"("stance");

-- RedefineIndex
DROP INDEX "StoryPerspective_storyId_idx";
CREATE INDEX "ReportAngle_reportId_idx" ON "ReportAngle"("reportId");
