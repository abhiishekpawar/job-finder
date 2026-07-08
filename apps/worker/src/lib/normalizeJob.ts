import { JobSource } from "@prisma/client";
import type { NormalizedJob } from "@/providers/types";

function valueToString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

export function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildNormalizedJob(input: {
  source: JobSource;
  sourceJobId?: unknown;
  title?: unknown;
  company?: unknown;
  location?: unknown;
  url?: unknown;
  salary?: unknown;
  postedAt?: unknown;
  description?: unknown;
}): NormalizedJob | null {
  const title = valueToString(input.title);
  const company = valueToString(input.company) ?? "Unknown company";
  const location = valueToString(input.location) ?? "Unknown location";
  const url = valueToString(input.url);

  if (!title || !url) {
    return null;
  }

  return {
    source: input.source,
    sourceJobId: valueToString(input.sourceJobId),
    title,
    company,
    location,
    url,
    salary: valueToString(input.salary),
    postedAt: toDate(input.postedAt),
    description: valueToString(input.description)
  };
}

export function isNormalizedJob(value: NormalizedJob | null): value is NormalizedJob {
  return value !== null;
}
