import { buildSearchRequest, searchSchema } from "@/lib/jobSearch/buildSearchRequest";
import { log, logError } from "@/lib/jobSearch/logger";
import { searchIndeed, searchLinkedIn, searchNaukri, searchOthers } from "@/lib/jobSearch/providers";
import { encodeSseEvent, type ProviderName } from "@/lib/jobSearch/streamEvents";
import type { SearchJob } from "@/lib/jobSearch/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const providers: Array<{
  name: ProviderName;
  run: typeof searchIndeed;
}> = [
  { name: "Indeed", run: searchIndeed },
  { name: "LinkedIn", run: searchLinkedIn },
  { name: "Naukri", run: searchNaukri },
  { name: "Others", run: searchOthers }
];

export async function POST(request: Request) {
  const payload = searchSchema.parse(await request.json());
  const { searchReq, debug } = buildSearchRequest(payload);

  log("POST /api/search/stream received", payload);
  log("Env check", {
    hasApifyToken: Boolean(process.env.APIFY_TOKEN),
    timeoutMs: process.env.APIFY_RUN_TIMEOUT_MS ?? 30_000
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeSseEvent>[0]) => {
        controller.enqueue(encodeSseEvent(event));
      };

      const providerSummary: Record<string, number> = {};
      const providerErrors: Record<string, string> = {};

      send({ type: "init", debug });

      await Promise.all(
        providers.map(async ({ name, run }) => {
          const startedAt = Date.now();
          send({ type: "provider_start", provider: name });

          try {
            log(`Stream provider start: ${name}`);
            const items: SearchJob[] = await run(searchReq);
            providerSummary[name] = items.length;
            send({ type: "jobs", provider: name, items, count: items.length });
            log(`Stream provider done: ${name}`, { count: items.length, ms: Date.now() - startedAt });
          } catch (err) {
            providerSummary[name] = 0;
            const message = err instanceof Error ? err.message : "Unknown provider error";
            providerErrors[name] = message;
            send({ type: "provider_error", provider: name, message });
            logError(`Stream provider failed: ${name}`, { ms: Date.now() - startedAt, message, err });
          }
        })
      );

      send({ type: "done", providerSummary, providerErrors });
      log("POST /api/search/stream complete", { providerSummary, providerErrors });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
