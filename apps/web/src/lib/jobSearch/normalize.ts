import type { JobSource, SearchJob } from "./types";

function valueToString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatExperienceRange(
  min?: unknown,
  max?: unknown,
  text?: unknown
): string | null {
  const direct = valueToString(text);
  if (direct) return direct;

  if (typeof min === "object" && min !== null) {
    const obj = min as Record<string, unknown>;
    return formatExperienceRange(obj.min, obj.max, obj.label ?? obj.text);
  }

  const minN = typeof min === "number" ? min : Number(min);
  const maxN = typeof max === "number" ? max : Number(max);
  const hasMin = Number.isFinite(minN);
  const hasMax = Number.isFinite(maxN);

  if (hasMin && hasMax) {
    if (minN === maxN) return `${minN} yrs`;
    return `${minN}-${maxN} yrs`;
  }
  if (hasMin) return `${minN}+ yrs`;
  if (hasMax) return `Up to ${maxN} yrs`;

  return null;
}

export function buildSearchJob(input: {
  source: JobSource;
  sourceJobId?: unknown;
  title?: unknown;
  company?: unknown;
  location?: unknown;
  url?: unknown;
  salary?: unknown;
  experienceRequired?: unknown;
  postedAt?: unknown;
  description?: unknown;
}): SearchJob | null {
  const title = valueToString(input.title);
  const company = valueToString(input.company) ?? "Unknown company";
  const location = valueToString(input.location) ?? "Unknown location";
  const url = valueToString(input.url);
  const sourceJobId = valueToString(input.sourceJobId);

  if (!title || !url) return null;

  const id = `${input.source}:${sourceJobId ?? url}`;

  return {
    id,
    source: input.source,
    title,
    company,
    location,
    url,
    salary: valueToString(input.salary),
    experienceRequired: valueToString(input.experienceRequired),
    postedAt: toDate(input.postedAt),
    description: valueToString(input.description),
    isNew: false
  };
}

export function dedupeJobs(items: SearchJob[]) {
  const seen = new Set<string>();
  const out: SearchJob[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
