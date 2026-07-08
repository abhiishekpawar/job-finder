import { log, logError } from "./logger";

type ApifyDatasetItem = Record<string, unknown>;

const APIFY_BASE_URL = "https://api.apify.com/v2";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function runActor<T extends ApifyDatasetItem>(actorId: string, input: Record<string, unknown>) {
  const token = getRequiredEnv("APIFY_TOKEN");
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;

  const timeoutMs = Number(process.env.APIFY_RUN_TIMEOUT_MS ?? 60_000);
  const startedAt = Date.now();

  log(`Apify call → ${actorId}`, { input, timeoutMs });

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    logError(`Apify timeout after ${timeoutMs}ms`, { actorId });
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input),
      signal: controller.signal
    });
  } catch (err) {
    const ms = Date.now() - startedAt;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Apify actor timed out (${actorId}) after ${timeoutMs}ms`);
    }
    logError(`Apify fetch error (${actorId})`, { ms, err });
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const ms = Date.now() - startedAt;
  log(`Apify response ← ${actorId}`, { status: response.status, ms });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logError(`Apify HTTP error (${actorId})`, { status: response.status, body: errorText.slice(0, 500) });
    throw new Error(`Apify actor failed (${actorId}): ${response.status} ${errorText}`);
  }

  const items = (await response.json()) as T[];
  log(`Apify dataset (${actorId})`, {
    ms,
    rawCount: items.length,
    sampleKeys: items[0] ? Object.keys(items[0]).slice(0, 12) : []
  });

  return items;
}

export async function runActorWithFallback<T extends ApifyDatasetItem>(
  attempts: Array<{ actorId: string; input: Record<string, unknown> }>
): Promise<{ items: T[]; actorId: string }> {
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const items = await runActor<T>(attempt.actorId, attempt.input);
      return { items, actorId: attempt.actorId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${attempt.actorId}: ${message}`);
      logError(`Apify fallback failed for ${attempt.actorId}`, { message });
    }
  }

  throw new Error(errors.join(" | "));
}

