import type { SearchJob, SearchRequest } from "./types";
import { runActor, runActorWithFallback } from "./apify";
import { dedupeJobs } from "./normalize";
import { mapJobItems } from "./mapJobItems";
import { log } from "./logger";
import { searchLinkedInGuest } from "./linkedinGuest";

const BLOCKED_APIFY_ACTORS = new Set([
  "bebity/linkedin-jobs-scraper",
  "codingfrontend/naukri-jobs-scraper"
]);

function filterActorAttempts(attempts: Array<{ actorId: string; input: Record<string, unknown> }>) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    if (BLOCKED_APIFY_ACTORS.has(attempt.actorId)) return false;
    if (seen.has(attempt.actorId)) return false;
    seen.add(attempt.actorId);
    return true;
  });
}

function mapLinkedInExperience(years: number): string {
  if (years <= 1) return "2";
  if (years <= 3) return "3";
  if (years <= 5) return "4";
  if (years <= 8) return "5";
  return "6";
}

export async function searchIndeed(req: SearchRequest): Promise<SearchJob[]> {
  const actorId = process.env.APIFY_INDEED_ACTOR_ID ?? "misceres/indeed-scraper";
  const locationOnly = req.location.split(",")[0]?.trim() || req.location;
  const input = {
    position: req.keyword,
    country: "IN",
    location: locationOnly,
    maxItemsPerSearch: req.maxResults,
    saveOnlyUniqueItems: true,
    parseCompanyDetails: false,
    followApplyRedirects: false
  };

  log("Indeed provider input", input);
  const items = await runActor<Record<string, unknown>>(actorId, input, req.token);

  const mapped = mapJobItems(items, "INDEED", {
    sourceJobId: ["jobId", "id"],
    title: ["positionName", "title"],
    company: ["companyName", "company"],
    location: ["location", "jobLocation"],
    url: ["url", "jobUrl"],
    salary: ["salary"],
    experience: ["experience", "experienceLevel", "yearsOfExperience"],
    postedAt: ["postedAt", "datePosted"],
    description: ["description"]
  });

  log("Indeed provider mapped", { raw: items.length, mapped: mapped.length });
  return dedupeJobs(mapped);
}

export async function searchLinkedIn(req: SearchRequest): Promise<SearchJob[]> {
  const apifyAttempts = filterActorAttempts([
    ...(process.env.APIFY_LINKEDIN_ACTOR_ID
      ? [
          {
            actorId: process.env.APIFY_LINKEDIN_ACTOR_ID,
            input: {
              searchQuery: req.keyword,
              location: req.location,
              maxJobs: req.maxResults,
              scrapeJobDetails: false,
              experienceLevel: mapLinkedInExperience(req.experienceYears)
            }
          }
        ]
      : []),
    {
      actorId: "automation-lab/linkedin-jobs-scraper",
      input: {
        searchQuery: req.keyword,
        location: req.location,
        maxJobs: req.maxResults,
        scrapeJobDetails: false,
        experienceLevel: mapLinkedInExperience(req.experienceYears)
      }
    },
    {
      actorId: "mfrostbutter/linkedin-jobs-scraper",
      input: {
        keywords: req.keyword,
        location: req.location,
        maxResults: req.maxResults,
        scrapeDescription: false
      }
    }
  ]);

  try {
    log("LinkedIn provider trying guest API first");
    return await searchLinkedInGuest(req);
  } catch (guestErr) {
    const guestMessage = guestErr instanceof Error ? guestErr.message : String(guestErr);
    log("LinkedIn guest API failed, falling back to Apify", { guestMessage });
    const { items, actorId } = await runActorWithFallback<Record<string, unknown>>(apifyAttempts, req.token);
    const mapped = mapJobItems(items, "LINKEDIN", {
      sourceJobId: ["jobId", "id"],
      title: ["title", "jobTitle"],
      company: ["companyName", "company"],
      location: ["location"],
      url: ["applyUrl", "jobUrl", "url", "link"],
      salary: ["salary", "salaryInfo"],
      experience: ["seniorityLevel", "experienceLevel", "experience"],
      postedAt: ["listedAt", "postDate", "postedAt", "datePosted"],
      description: ["description", "descriptionText"]
    });
    log("LinkedIn provider mapped (Apify fallback)", { actorId, raw: items.length, mapped: mapped.length });
    return dedupeJobs(mapped);
  }
}

export async function searchNaukri(req: SearchRequest): Promise<SearchJob[]> {
  const locationOnly = req.location.split(",")[0]?.trim() || req.location;
  const configuredActor = process.env.APIFY_NAUKRI_ACTOR_ID;
  const attempts = filterActorAttempts([
    ...(configuredActor
      ? [
          {
            actorId: configuredActor,
            input: {
              keyword: req.keyword,
              location: locationOnly,
              experienceMin: req.experienceYears,
              maxItems: req.maxResults
            }
          }
        ]
      : []),
    {
      actorId: "jungle_synthesizer/naukri-com-scraper",
      input: {
        keyword: req.keyword,
        location: locationOnly,
        experienceMin: req.experienceYears,
        maxItems: req.maxResults
      }
    },
    {
      actorId: "logiover/naukri-job-scraper",
      input: {
        keywords: [req.keyword],
        locations: locationOnly ? [locationOnly] : [],
        experienceMin: req.experienceYears,
        maxPages: 1,
        scrapeJobDetails: false
      }
    },
    {
      actorId: "trakk/naukri-job-scraper",
      input: {
        keyword: req.keyword,
        experience: String(req.experienceYears),
        cities: locationOnly ? [locationOnly] : [],
        maxJobs: Math.max(req.maxResults, 50),
        fetchDetails: false
      }
    }
  ]);

  log("Naukri provider input", { attempts: attempts.map((a) => a.actorId) });
  const { items, actorId } = await runActorWithFallback<Record<string, unknown>>(attempts, req.token);

  const mapped = mapJobItems(items, "NAUKRI", {
    sourceJobId: ["jobId", "id"],
    title: ["title", "post"],
    company: ["companyName", "company", "staticCompanyName"],
    location: ["location", "cityfield", "city"],
    url: ["jobUrl", "url", "urlStr"],
    salary: ["salary", "salaryText"],
    experience: ["experience", "experienceText", "experienceRange"],
    postedAt: ["postedDate", "postedAt", "createdAt", "addDate"],
    description: ["jobDescription", "fullDescription", "shortDescription", "description"]
  }).slice(0, req.maxResults);

  log("Naukri provider mapped", { actorId, raw: items.length, mapped: mapped.length });
  return dedupeJobs(mapped);
}

export { searchOthers } from "./othersProvider";
