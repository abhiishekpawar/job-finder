import type { JobSource, SearchJob } from "./types";
import { buildSearchJob, formatExperienceRange } from "./normalize";

type FieldMap = {
  sourceJobId?: string[];
  title?: string[];
  company?: string[];
  location?: string[];
  url?: string[];
  salary?: string[];
  experience?: string[];
  experienceMin?: string[];
  experienceMax?: string[];
  postedAt?: string[];
  description?: string[];
};

function pick(item: Record<string, unknown>, keys?: string[]) {
  if (!keys) return undefined;
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function pickExperience(item: Record<string, unknown>, fieldMap: FieldMap) {
  const raw = pick(item, fieldMap.experience);
  if (raw && typeof raw === "object") {
    return formatExperienceRange(raw);
  }

  const text = raw;
  const min = pick(item, fieldMap.experienceMin);
  const max = pick(item, fieldMap.experienceMax);
  return formatExperienceRange(min, max, text);
}

function pickLocation(item: Record<string, unknown>, fieldMap: FieldMap) {
  const direct = pick(item, fieldMap.location);
  if (direct) {
    if (Array.isArray(direct)) return direct.join(", ");
    return direct;
  }

  const locations = item.locations ?? item.placeholders;
  if (Array.isArray(locations)) {
    if (locations.every((entry) => typeof entry === "string")) {
      return locations.join(", ");
    }
    for (const entry of locations) {
      if (typeof entry === "object" && entry !== null && "label" in entry) {
        const label = (entry as { label?: string }).label;
        if (label) return label;
      }
    }
  }

  return undefined;
}

export function mapJobItems(
  items: Record<string, unknown>[],
  source: JobSource,
  fieldMap: FieldMap
): SearchJob[] {
  return items
    .map((item) =>
      buildSearchJob({
        source,
        sourceJobId: pick(item, fieldMap.sourceJobId),
        title: pick(item, fieldMap.title),
        company: pick(item, fieldMap.company),
        location: pickLocation(item, fieldMap),
        url: pick(item, fieldMap.url),
        salary: pick(item, fieldMap.salary),
        experienceRequired: pickExperience(item, fieldMap),
        postedAt: pick(item, fieldMap.postedAt),
        description: pick(item, fieldMap.description)
      })
    )
    .filter((item): item is SearchJob => item !== null);
}

export function mapOtherBoardItems(items: Record<string, unknown>[]): SearchJob[] {
  return items
    .map((item) => {
      const board = String(item.board ?? item.source ?? item.platform ?? "").toLowerCase();
      const source: JobSource =
        board.includes("shine")
          ? "SHINE"
          : board.includes("foundit") || board.includes("monster")
            ? "FOUNDIT"
            : board.includes("glassdoor")
              ? "GLASSDOOR"
              : "SHINE";

      return buildSearchJob({
        source,
        sourceJobId: pick(item, ["jobId", "id"]),
        title: pick(item, ["title", "jobTitle"]),
        company: pick(item, ["company", "companyName"]),
        location: pickLocation(item, { location: ["location", "locations", "city"] }),
        url: pick(item, ["jobUrl", "url", "applyUrl"]),
        salary: pick(item, ["salaryRaw", "salary", "salaryText"]),
        experienceRequired: formatExperienceRange(
          item.experienceMin,
          item.experienceMax,
          pick(item, ["experience", "experienceText", "experienceRange"])
        ),
        postedAt: pick(item, ["postedAt", "postedDate", "createdAt"]),
        description: pick(item, ["description", "jobDescription"])
      });
    })
    .filter((item): item is SearchJob => item !== null);
}
