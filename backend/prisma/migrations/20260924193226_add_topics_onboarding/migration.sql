-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_topics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_topics" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE INDEX "user_topics_userId_idx" ON "user_topics"("userId");

-- CreateIndex
CREATE INDEX "user_topics_topicId_idx" ON "user_topics"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "user_topics_userId_topicId_key" ON "user_topics"("userId", "topicId");

-- CreateIndex
CREATE INDEX "source_topics_sourceId_idx" ON "source_topics"("sourceId");

-- CreateIndex
CREATE INDEX "source_topics_topicId_idx" ON "source_topics"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "source_topics_sourceId_topicId_key" ON "source_topics"("sourceId", "topicId");

-- AddForeignKey
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_topics" ADD CONSTRAINT "source_topics_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_topics" ADD CONSTRAINT "source_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
