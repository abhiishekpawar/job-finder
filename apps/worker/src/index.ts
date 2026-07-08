import { runDueSearches } from "@/jobs/dailySearch";
import { logger } from "@/lib/logger";

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 300_000);

async function mainLoop() {
  try {
    const processed = await runDueSearches();
    logger.info(`Polling cycle finished`, { processed });
  } catch (error) {
    logger.error("Polling cycle crashed", error);
  }
}

mainLoop();
setInterval(mainLoop, pollIntervalMs);
