import { z } from "zod";
import type { SearchRequest } from "./types";

export const searchSchema = z.object({
  skills: z.string().min(1),
  experienceYears: z.number().int().min(0).max(50),
  location: z.string().min(1),
  keyword: z.string().optional(),
  maxResults: z.number().int().min(5).max(100).optional(),
  token: z.string().min(1).optional()
});

export function buildSearchRequest(payload: z.infer<typeof searchSchema>): {
  searchReq: SearchRequest;
  debug: {
    keyword: string;
    location: string;
    maxResults: number;
    requestedMaxResults: number;
  };
} {
  const requestedMaxResults =
    payload.maxResults ?? Number(process.env.DEFAULT_RESULTS_PER_SOURCE ?? 25);
  const maxResults = requestedMaxResults;
  const keyword = payload.skills.trim();

  return {
    searchReq: {
      skills: payload.skills,
      experienceYears: payload.experienceYears,
      location: payload.location,
      keyword,
      maxResults,
      token: payload.token?.trim() || undefined
    },
    debug: {
      keyword,
      location: payload.location,
      requestedMaxResults,
      maxResults
    }
  };
}
