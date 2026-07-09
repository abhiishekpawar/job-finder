export type ResumeAnalysisResult = {
  score: number;
  verdict: "good_match" | "needs_improvement" | "low_match";
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  missingSkills: string[];
};

export type ResumeCheckerJobContext = {
  source: string;
  jobUrl: string;
  jobTitle: string;
  company: string;
  location: string;
  requiredYears: number;
  jobDescription: string;
};

export const TOKEN_STORAGE_KEY = "job-hunter-token";
export const AI_TOKEN_STORAGE_KEY = "job-hunter-ai-token";
export const AI_PROVIDER_STORAGE_KEY = "job-hunter-ai-provider";

export type AiProvider = "gemini" | "groq";

export const RESUME_JOB_STORAGE_KEY = "resume-checker-job";
