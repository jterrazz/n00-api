-- Rename Story table to Report
ALTER TABLE "Story" RENAME TO "Report";

-- Rename StoryPerspective table to ReportAngle
ALTER TABLE "StoryPerspective" RENAME TO "ReportAngle";

-- Rename ArticleVariant table to ArticleFrame
ALTER TABLE "ArticleVariant" RENAME TO "ArticleFrame";

-- Update column names in ReportAngle table
ALTER TABLE "ReportAngle" RENAME COLUMN "storyId" TO "reportId";

-- Update the many-to-many relationship table if it exists
-- Note: SQLite doesn't support renaming tables in foreign key constraints directly
-- The foreign key constraints will be handled by Prisma's schema introspection