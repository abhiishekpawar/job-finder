import type { SearchJob, SearchRequest } from "./types";
import { runActor, runActorWithFallback } from "./apify";
import { dedupeJobs } from "./normalize";
import { mapJobItems, mapOtherBoardItems } from "./mapJobItems";
import { log } from "./logger";

function locationOnly(req: SearchRequest) {
  return req.location.split(",")[0]?.trim() || req.location;
}

async function searchShine(req: SearchRequest): Promise<SearchJob[]> {
  const location = locationOnly(req);
  const items = await runActor<Record<string, unknown>>(
    process.env.APIFY_SHINE_ACTOR_ID ?? "automation-lab/shine-jobs-scraper",
    {
      keyword: req.keyword,
      location,
      maxItems: req.maxResults,
      maxPages: Math.max(1, Math.ceil(req.maxResults / 20))
    },
    req.token
  );

  return mapJobItems(items, "SHINE", {
    sourceJobId: ["jobId", "id"],
    title: ["title", "jobTitle"],
    company: ["company", "companyName"],
    location: ["location", "locations"],
    url: ["jobUrl", "url"],
    salary: ["salary", "salaryText"],
    experience: ["experience", "experienceText", "experienceRange"],
    postedAt: ["postedAt", "postedDate"],
    description: ["description", "jobDescription"]
  });
}

async function searchFoundit(req: SearchRequest): Promise<SearchJob[]> {
  const location = locationOnly(req);
  const searchUrl = `https://www.foundit.in/srp/results?query=${encodeURIComponent(req.keyword)}&locations=${encodeURIComponent(location)}`;
  const items = await runActor<Record<string, unknown>>(
    process.env.APIFY_FOUNDIT_ACTOR_ID ?? "easyapi/foundit-jobs-scraper",
    {
      searchUrls: [searchUrl],
      maxItems: req.maxResults
    },
    req.token
  );

  return mapJobItems(items, "FOUNDIT", {
    sourceJobId: ["jobId", "id"],
    title: ["title", "jobTitle"],
    company: ["company", "companyName"],
    location: ["locations", "location"],
    url: ["jobUrl", "url", "applyUrl"],
    salary: ["salary", "salaryText"],
    experience: ["experience"],
    postedAt: ["postedAt", "postedDate"],
    description: ["description", "jobDescription"]
  });
}

export async function searchOthers(req: SearchRequest): Promise<SearchJob[]> {
  const location = locationOnly(req);
  const suiteAttempts = [
    {
      actorId: process.env.APIFY_OTHERS_ACTOR_ID ?? "dp862/india-jobs-suite",
      input: {
        keyword: req.keyword,
        location,
        boards: ["foundit", "shine"],
        maxItemsPerBoard: req.maxResults,
        dedupe: false
      }
    }
  ];

  log("Others provider input", { location, maxResults: req.maxResults });

  try {
    const { items, actorId } = await runActorWithFallback<Record<string, unknown>>(suiteAttempts, req.token);
    const mapped = dedupeJobs(mapOtherBoardItems(items));
    log("Others provider mapped (suite)", { actorId, raw: items.length, mapped: mapped.length });
    if (mapped.length > 0) return mapped;
  } catch (suiteErr) {
    const message = suiteErr instanceof Error ? suiteErr.message : String(suiteErr);
    log("Others suite failed, trying individual boards", { message });
  }

  const settled = await Promise.allSettled([searchShine(req), searchFoundit(req)]);
  const merged = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  if (!merged.length) {
    const errors = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));
    throw new Error(errors.join(" | ") || "Others provider returned no jobs");
  }

  const mapped = dedupeJobs(merged);
  log("Others provider mapped (fallback)", { mapped: mapped.length });
  return mapped;
}
