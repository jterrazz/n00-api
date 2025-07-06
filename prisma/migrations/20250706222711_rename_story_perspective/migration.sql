/*
  Warnings:

  - You are about to drop the `Perspective` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Perspective";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "StoryPerspective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holisticDigest" TEXT NOT NULL,
    "stance" TEXT,
    "discourse" TEXT,
    "storyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryPerspective_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StoryPerspective_storyId_idx" ON "StoryPerspective"("storyId");

-- CreateIndex
CREATE INDEX "StoryPerspective_stance_idx" ON "StoryPerspective"("stance");

-- CreateIndex
CREATE INDEX "StoryPerspective_discourse_idx" ON "StoryPerspective"("discourse");
