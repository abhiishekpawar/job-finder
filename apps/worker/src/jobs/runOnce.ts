import { runDueSearches, runSingleSchedule } from "@/jobs/dailySearch";
import { logger } from "@/lib/logger";

async function main() {
  const scheduleId = process.env.SCHEDULE_ID;
  if (scheduleId) {
    const totalMatches = await runSingleSchedule(scheduleId);
    logger.info("One-off schedule run complete", { scheduleId, totalMatches });
    return;
  }

  const processed = await runDueSearches();
  logger.info("One-off run complete", { processed });
}

main().catch((error) => {
  logger.error("One-off run failed", error);
  process.exitCode = 1;
});
