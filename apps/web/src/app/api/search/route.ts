import { NextResponse } from "next/server";
import { buildSearchRequest, searchSchema } from "../../../lib/jobSearch/buildSearchRequest";
import { log, logError } from "../../../lib/jobSearch/logger";
import { searchIndeed, searchLinkedIn, searchNaukri, searchOthers } from "../../../lib/jobSearch/providers";
import type { SearchResponse } from "../../../lib/jobSearch/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestStarted = Date.now();
  const payload = searchSchema.parse(await request.json());

  log("POST /api/search received", payload);

  const { searchReq, debug } = buildSearchRequest(payload);
  const providerSummary: Record<string, number> = {};
  const providerErrors: Record<string, string> = {};

  const providers = [
    { name: "Indeed", run: () => searchIndeed(searchReq) },
    { name: "LinkedIn", run: () => searchLinkedIn(searchReq) },
    { name: "Naukri", run: () => searchNaukri(searchReq) },
    { name: "Others", run: () => searchOthers(searchReq) }
  ];

  const all: SearchResponse["items"] = [];

  await Promise.all(
    providers.map(async (provider) => {
      const providerStart = Date.now();
      try {
        log(`Provider start: ${provider.name}`);
        const items = await provider.run();
        providerSummary[provider.name] = items.length;
        all.push(...items);
        log(`Provider done: ${provider.name}`, { count: items.length, ms: Date.now() - providerStart });
      } catch (err) {
        providerSummary[provider.name] = 0;
        const message = err instanceof Error ? err.message : "Unknown provider error";
        providerErrors[provider.name] = message;
        logError(`Provider failed: ${provider.name}`, { ms: Date.now() - providerStart, message, err });
      }
    })
  );

  const results: SearchResponse = {
    items: all,
    providerSummary,
    providerErrors,
    debug
  };

  log("POST /api/search complete", {
    totalJobs: all.length,
    providerSummary,
    providerErrors,
    ms: Date.now() - requestStarted
  });

  return NextResponse.json(results, { status: 200 });
}

