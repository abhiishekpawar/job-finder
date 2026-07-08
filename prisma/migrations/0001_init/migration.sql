-- CreateEnum
CREATE TYPE "SearchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('INDEED', 'LINKEDIN', 'NAUKRI');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSearchSchedule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "timeOfDay" TEXT NOT NULL,
  "maxResults" INTEGER NOT NULL DEFAULT 25,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastTriggeredAt" TIMESTAMP(3),
  CONSTRAINT "JobSearchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSearchRun" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "status" "SearchRunStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobResult" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "source" "JobSource" NOT NULL,
  "sourceJobId" TEXT,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "salary" TEXT,
  "postedAt" TIMESTAMP(3),
  "description" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSearchRunResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "jobResultId" TEXT NOT NULL,
  "isNew" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSearchRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobResultId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "JobSearchSchedule_userId_enabled_idx" ON "JobSearchSchedule"("userId", "enabled");
CREATE INDEX "JobSearchRun_scheduleId_createdAt_idx" ON "JobSearchRun"("scheduleId", "createdAt" DESC);
CREATE UNIQUE INDEX "JobResult_scheduleId_source_sourceJobId_key" ON "JobResult"("scheduleId", "source", "sourceJobId");
CREATE UNIQUE INDEX "JobResult_scheduleId_source_url_key" ON "JobResult"("scheduleId", "source", "url");
CREATE INDEX "JobResult_scheduleId_firstSeenAt_idx" ON "JobResult"("scheduleId", "firstSeenAt" DESC);
CREATE UNIQUE INDEX "JobSearchRunResult_runId_jobResultId_key" ON "JobSearchRunResult"("runId", "jobResultId");
CREATE INDEX "JobSearchRunResult_runId_isNew_idx" ON "JobSearchRunResult"("runId", "isNew");
CREATE UNIQUE INDEX "SavedJob_userId_jobResultId_key" ON "SavedJob"("userId", "jobResultId");

-- AddForeignKey
ALTER TABLE "JobSearchSchedule"
ADD CONSTRAINT "JobSearchSchedule_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobSearchRun"
ADD CONSTRAINT "JobSearchRun_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "JobSearchSchedule"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobResult"
ADD CONSTRAINT "JobResult_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "JobSearchSchedule"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobSearchRunResult"
ADD CONSTRAINT "JobSearchRunResult_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "JobSearchRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobSearchRunResult"
ADD CONSTRAINT "JobSearchRunResult_jobResultId_fkey"
FOREIGN KEY ("jobResultId") REFERENCES "JobResult"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedJob"
ADD CONSTRAINT "SavedJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedJob"
ADD CONSTRAINT "SavedJob_jobResultId_fkey"
FOREIGN KEY ("jobResultId") REFERENCES "JobResult"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
