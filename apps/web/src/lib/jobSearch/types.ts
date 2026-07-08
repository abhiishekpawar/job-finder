export type JobSource =
  | "INDEED"
  | "LINKEDIN"
  | "NAUKRI"
  | "SHINE"
  | "FOUNDIT"
  | "GLASSDOOR";

export const SOURCE_LABELS: Record<JobSource, string> = {
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  NAUKRI: "Naukri",
  SHINE: "Shine",
  FOUNDIT: "Foundit",
  GLASSDOOR: "Glassdoor"
};

export type SearchJob = {
  id: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  experienceRequired: string | null;
  url: string;
  postedAt: string | null;
  description: string | null;
  isNew: boolean;
};

export type SearchRequest = {
  skills: string;
  experienceYears: number;
  location: string;
  keyword: string;
  maxResults: number;
  token?: string;
};

export type SearchResponse = {
  items: SearchJob[];
  providerSummary: Record<string, number>;
  providerErrors: Record<string, string>;
  debug: {
    keyword: string;
    location: string;
    maxResults: number;
    requestedMaxResults?: number;
  };
};
