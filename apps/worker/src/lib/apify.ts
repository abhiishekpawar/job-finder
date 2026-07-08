type ApifyResponseItem = Record<string, unknown>;

const APIFY_BASE_URL = "https://api.apify.com/v2";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function runActor<T extends ApifyResponseItem>(
  actorId: string,
  input: Record<string, unknown>
): Promise<T[]> {
  const token = getRequiredEnv("APIFY_TOKEN");
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify actor failed (${actorId}): ${response.status} ${errorText}`);
  }

  return (await response.json()) as T[];
}
