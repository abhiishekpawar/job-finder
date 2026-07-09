import { NextResponse } from "next/server";

type Payload = {
  source?: string;
  jobUrl?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractLinkedInJobId(url: string) {
  const direct = url.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (direct) return direct;

  const trailing = url.match(/-(\d+)(?:\/|\?|$)/)?.[1];
  if (trailing) return trailing;

  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("currentJobId") ?? parsed.searchParams.get("jobId");
    return fromQuery || null;
  } catch {
    return null;
  }
}

function extractDescriptionFromHtml(html: string) {
  const jsonLdMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of jsonLdMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        const desc = (candidate?.description as string | undefined) ?? "";
        const text = stripHtml(desc);
        if (text.length > 120) return text;
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }

  const knownBlocks = [
    /show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i,
    /description__text[^>]*>([\s\S]*?)<\/div>/i,
    /jobDescriptionText[^>]*>([\s\S]*?)<\/div>/i,
    /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="description"[^>]*content="([^"]+)"/i
  ];

  for (const pattern of knownBlocks) {
    const match = html.match(pattern);
    const text = match?.[1] ? stripHtml(match[1]) : "";
    if (text.length > 120) return text;
  }

  return null;
}

async function fetchLinkedInDescription(jobUrl: string) {
  const jobId = extractLinkedInJobId(jobUrl);
  if (!jobId) return null;

  const endpoint = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const response = await fetch(endpoint, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9"
    },
    cache: "no-store"
  });
  if (!response.ok) return null;
  return extractDescriptionFromHtml(await response.text());
}

async function fetchDescriptionFromJobPage(jobUrl: string) {
  const response = await fetch(jobUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9"
    },
    cache: "no-store"
  });
  if (!response.ok) return null;
  return extractDescriptionFromHtml(await response.text());
}

export async function POST(request: Request) {
  const payload = (await request.json()) as Payload;
  const source = payload.source?.toUpperCase();
  const jobUrl = payload.jobUrl?.trim();

  let description: string | null = null;

  if (source === "LINKEDIN" && jobUrl) {
    description = await fetchLinkedInDescription(jobUrl);
  }
  if (!description && jobUrl) {
    description = await fetchDescriptionFromJobPage(jobUrl);
  }

  if (!description) {
    description = `${payload.jobTitle ?? "Job role"} at ${payload.company ?? "the company"} in ${
      payload.location ?? "the specified location"
    }`;
  }

  return NextResponse.json({ description });
}
