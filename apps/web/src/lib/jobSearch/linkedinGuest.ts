import type { SearchJob, SearchRequest } from "./types";
import { buildSearchJob, dedupeJobs } from "./normalize";
import { log, logError } from "./logger";

const LINKEDIN_GUEST_SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

function mapExperienceLevel(years: number): string {
  if (years <= 1) return "2";
  if (years <= 3) return "3";
  if (years <= 5) return "4";
  if (years <= 8) return "5";
  return "6";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

type ParsedCard = {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string | null;
  experienceRequired: string | null;
};

function parseJobCards(html: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  const cardChunks = html.split('<li>').slice(1);

  for (const chunk of cardChunks) {
    const titleMatch =
      chunk.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/i) ??
      chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const companyMatch =
      chunk.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/i) ??
      chunk.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const locationMatch = chunk.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/i);
    const urlMatch = chunk.match(/href="([^"]*\/jobs\/view\/[^"]+)"/i);
    const timeMatch = chunk.match(/<time[^>]*datetime="([^"]+)"/i);
    const metadataItems = [...chunk.matchAll(/job-search-card__metadata-item[^>]*>([^<]+)/gi)].map(
      (match) => stripTags(match[1])
    );
    const experienceRequired =
      metadataItems.find((item) => /yr|year|entry|senior|associate|intern|director|executive/i.test(item)) ??
      metadataItems[0] ??
      null;

    const title = titleMatch ? stripTags(titleMatch[1]) : "";
    const company = companyMatch ? stripTags(companyMatch[1]) : "";
    const location = locationMatch ? stripTags(locationMatch[1]) : "Unknown location";
    const url = urlMatch ? decodeHtml(urlMatch[1]) : "";

    if (!title || !url) continue;

    cards.push({
      title,
      company: company || "Unknown company",
      location,
      url: url.startsWith("http") ? url : `https://www.linkedin.com${url}`,
      postedAt: timeMatch?.[1] ?? null,
      experienceRequired
    });
  }

  return cards;
}

export async function searchLinkedInGuest(req: SearchRequest): Promise<SearchJob[]> {
  const cards: ParsedCard[] = [];
  const seenUrls = new Set<string>();
  const pageSize = 10;
  const maxPages = Math.ceil(req.maxResults / pageSize) + 3;

  for (let page = 0; page < maxPages && cards.length < req.maxResults; page++) {
    const start = page * pageSize;
    const params = new URLSearchParams({
      keywords: req.keyword,
      location: req.location,
      start: String(start),
      f_E: mapExperienceLevel(req.experienceYears)
    });

    const url = `${LINKEDIN_GUEST_SEARCH_URL}?${params.toString()}`;
    log("LinkedIn guest API request", {
      keyword: req.keyword,
      location: req.location,
      start,
      maxResults: req.maxResults
    });

    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(Number(process.env.LINKEDIN_GUEST_TIMEOUT_MS ?? 15_000))
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logError("LinkedIn guest API failed", { status: response.status, body: body.slice(0, 300) });
      if (cards.length > 0) break;
      throw new Error(`LinkedIn guest API failed (${response.status})`);
    }

    const pageCards = parseJobCards(await response.text());
    if (!pageCards.length) break;

    for (const card of pageCards) {
      if (seenUrls.has(card.url)) continue;
      seenUrls.add(card.url);
      cards.push(card);
      if (cards.length >= req.maxResults) break;
    }
  }

  const mapped = cards
    .slice(0, req.maxResults)
    .map((card) =>
      buildSearchJob({
        source: "LINKEDIN",
        sourceJobId: card.url.match(/(\d+)(?:\?|$)/)?.[1],
        title: card.title,
        company: card.company,
        location: card.location,
        url: card.url,
        postedAt: card.postedAt,
        experienceRequired: card.experienceRequired
      })
    )
    .filter((item): item is SearchJob => item !== null);

  log("LinkedIn guest API mapped", { raw: cards.length, mapped: mapped.length });
  return dedupeJobs(mapped);
}
