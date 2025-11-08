-- Rename traitsUplifting to traitsPositive in Report table
ALTER TABLE "Report" RENAME COLUMN "traitsUplifting" TO "traitsPositive";

-- Rename traitsUplifting to traitsPositive in Article table
ALTER TABLE "Article" RENAME COLUMN "traitsUplifting" TO "traitsPositive";