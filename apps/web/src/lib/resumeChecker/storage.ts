import type { ResumeCheckerJobContext } from "@/lib/resumeChecker/types";
import { RESUME_JOB_STORAGE_KEY } from "@/lib/resumeChecker/types";
import type { SearchJob } from "@/lib/jobSearch/types";

export function parseRequiredYears(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function searchJobToResumeContext(job: SearchJob): ResumeCheckerJobContext {
  return {
    source: job.source,
    jobUrl: job.url,
    jobTitle: job.title,
    company: job.company,
    location: job.location,
    requiredYears: parseRequiredYears(job.experienceRequired),
    jobDescription: job.description ?? ""
  };
}

export function saveResumeCheckerJob(job: ResumeCheckerJobContext) {
  localStorage.setItem(RESUME_JOB_STORAGE_KEY, JSON.stringify(job));
}

export function loadResumeCheckerJob(): ResumeCheckerJobContext | null {
  try {
    const raw = localStorage.getItem(RESUME_JOB_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeCheckerJobContext;
  } catch {
    return null;
  }
}

export function buildResumeCheckerUrl(job: ResumeCheckerJobContext): string {
  const params = new URLSearchParams({
    prefill: "1",
    jobTitle: job.jobTitle,
    jobUrl: job.jobUrl,
    company: job.company,
    location: job.location,
    requiredYears: String(job.requiredYears),
    source: job.source
  });
  return `/resume-checker?${params.toString()}`;
}

export function openResumeChecker(job: SearchJob) {
  const context = searchJobToResumeContext(job);
  try {
    saveResumeCheckerJob(context);
  } catch {
    // continue with URL params if storage is unavailable
  }
  window.open(buildResumeCheckerUrl(context), "_blank", "noopener,noreferrer");
}

export function resumeContextFromSearchParams(
  searchParams: URLSearchParams
): ResumeCheckerJobContext | null {
  const jobTitle = searchParams.get("jobTitle");
  const jobUrl = searchParams.get("jobUrl");
  if (!jobTitle && !jobUrl) return null;

  return {
    source: searchParams.get("source") ?? "",
    jobUrl: jobUrl ?? "",
    jobTitle: jobTitle ?? "",
    company: searchParams.get("company") ?? "",
    location: searchParams.get("location") ?? "",
    requiredYears: Number.parseInt(searchParams.get("requiredYears") ?? "0", 10) || 0,
    jobDescription: searchParams.get("jobDescription") ?? ""
  };
}
