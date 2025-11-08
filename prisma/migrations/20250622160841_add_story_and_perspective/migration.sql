-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "dateline" DATETIME NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Perspective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holisticDigest" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Perspective_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerspectiveTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stance" TEXT,
    "discourseType" TEXT,
    "perspectiveId" TEXT NOT NULL,
    CONSTRAINT "PerspectiveTag_perspectiveId_fkey" FOREIGN KEY ("perspectiveId") REFERENCES "Perspective" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Story_category_idx" ON "Story"("category");

-- CreateIndex
CREATE INDEX "Story_dateline_idx" ON "Story"("dateline");

-- CreateIndex
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");

-- CreateIndex
CREATE INDEX "Perspective_storyId_idx" ON "Perspective"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "PerspectiveTag_perspectiveId_key" ON "PerspectiveTag"("perspectiveId");

-- CreateIndex
CREATE INDEX "PerspectiveTag_stance_idx" ON "PerspectiveTag"("stance");

-- CreateIndex
CREATE INDEX "PerspectiveTag_discourseType_idx" ON "PerspectiveTag"("discourseType");
