import { SearchRunStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { IndeedProvider } from "@/providers/apify/indeed";
import { LinkedInProvider } from "@/providers/apify/linkedin";
import { NaukriProvider } from "@/providers/apify/naukri";
import type { JobProvider, NormalizedJob } from "@/providers/types";

const providers: JobProvider[] = [new IndeedProvider(), new LinkedInProvider(), new NaukriProvider()];

function hhmmToParts(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return { hours, minutes };
}

function isScheduleDue(timeOfDay: string, lastTriggeredAt: Date | null, now = new Date()) {
  const { hours, minutes } = hhmmToParts(timeOfDay);
  const dueAt = new Date(now);
  dueAt.setHours(hours, minutes, 0, 0);

  if (now < dueAt) {
    return false;
  }

  if (!lastTriggeredAt) {
    return true;
  }

  return lastTriggeredAt < dueAt;
}

async function upsertJob(scheduleId: string, job: NormalizedJob) {
  const whereBySourceId =
    job.sourceJobId !== null
      ? {
          scheduleId_source_sourceJobId: {
            scheduleId,
            source: job.source,
            sourceJobId: job.sourceJobId
          }
        }
      : null;

  if (whereBySourceId) {
    return db.jobResult.upsert({
      where: whereBySourceId,
      update: {
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        salary: job.salary,
        postedAt: job.postedAt,
        description: job.description,
        lastSeenAt: new Date()
      },
      create: {
        scheduleId,
        source: job.source,
        sourceJobId: job.sourceJobId,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        salary: job.salary,
        postedAt: job.postedAt,
        description: job.description
      }
    });
  }

  return db.jobResult.upsert({
    where: {
      scheduleId_source_url: {
        scheduleId,
        source: job.source,
        url: job.url
      }
    },
    update: {
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      postedAt: job.postedAt,
      description: job.description,
      lastSeenAt: new Date()
    },
    create: {
      scheduleId,
      source: job.source,
      sourceJobId: job.sourceJobId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      salary: job.salary,
      postedAt: job.postedAt,
      description: job.description
    }
  });
}

async function processRun(runId: string, schedule: { id: string; keyword: string; location: string; maxResults: number }) {
  const seenJobIds = new Set<string>();

  for (const provider of providers) {
    const jobs = await provider.search({
      keyword: schedule.keyword,
      location: schedule.location,
      maxResults: schedule.maxResults
    });

    for (const job of jobs) {
      const existing = await db.jobResult.findFirst({
        where: {
          scheduleId: schedule.id,
          source: job.source,
          OR: job.sourceJobId ? [{ sourceJobId: job.sourceJobId }, { url: job.url }] : [{ url: job.url }]
        },
        select: { id: true }
      });

      const saved = await upsertJob(schedule.id, job);
      seenJobIds.add(saved.id);

      await db.jobSearchRunResult.upsert({
        where: {
          runId_jobResultId: {
            runId,
            jobResultId: saved.id
          }
        },
        update: {
          isNew: !existing
        },
        create: {
          runId,
          jobResultId: saved.id,
          isNew: !existing
        }
      });
    }
  }

  return seenJobIds.size;
}

export async function runDueSearches(now = new Date()) {
  const schedules = await db.jobSearchSchedule.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" }
  });

  let processed = 0;

  for (const schedule of schedules) {
    if (!isScheduleDue(schedule.timeOfDay, schedule.lastTriggeredAt, now)) {
      continue;
    }

    processed += 1;
    const run = await db.jobSearchRun.create({
      data: {
        scheduleId: schedule.id,
        status: SearchRunStatus.RUNNING,
        startedAt: new Date()
      }
    });

    try {
      const totalMatches = await processRun(run.id, schedule);

      await db.$transaction([
        db.jobSearchRun.update({
          where: { id: run.id },
          data: {
            status: SearchRunStatus.SUCCEEDED,
            finishedAt: new Date()
          }
        }),
        db.jobSearchSchedule.update({
          where: { id: schedule.id },
          data: {
            lastTriggeredAt: new Date()
          }
        })
      ]);

      logger.info(`Search run succeeded for schedule ${schedule.id}`, { totalMatches });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown worker failure";

      await db.jobSearchRun.update({
        where: { id: run.id },
        data: {
          status: SearchRunStatus.FAILED,
          errorMessage,
          finishedAt: new Date()
        }
      });

      logger.error(`Search run failed for schedule ${schedule.id}`, errorMessage);
    }
  }

  return processed;
}

export async function runSingleSchedule(scheduleId: string) {
  const schedule = await db.jobSearchSchedule.findUnique({
    where: { id: scheduleId }
  });

  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }

  const run = await db.jobSearchRun.create({
    data: {
      scheduleId: schedule.id,
      status: SearchRunStatus.RUNNING,
      startedAt: new Date()
    }
  });

  try {
    const totalMatches = await processRun(run.id, schedule);

    await db.$transaction([
      db.jobSearchRun.update({
        where: { id: run.id },
        data: {
          status: SearchRunStatus.SUCCEEDED,
          finishedAt: new Date()
        }
      }),
      db.jobSearchSchedule.update({
        where: { id: schedule.id },
        data: {
          lastTriggeredAt: new Date()
        }
      })
    ]);

    logger.info(`Single search run succeeded for schedule ${schedule.id}`, { totalMatches });
    return totalMatches;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown worker failure";

    await db.jobSearchRun.update({
      where: { id: run.id },
      data: {
        status: SearchRunStatus.FAILED,
        errorMessage,
        finishedAt: new Date()
      }
    });

    throw error;
  }
}
