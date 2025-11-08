/*
  Warnings:

  - You are about to drop the `StoryReference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StoryReference";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "_StoryArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_StoryArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_StoryArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_StoryArticles_AB_unique" ON "_StoryArticles"("A", "B");

-- CreateIndex
CREATE INDEX "_StoryArticles_B_index" ON "_StoryArticles"("B");
