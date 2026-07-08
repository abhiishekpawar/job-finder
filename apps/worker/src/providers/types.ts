import type { JobSource } from "@prisma/client";

export type ProviderSearchInput = {
  keyword: string;
  location: string;
  maxResults: number;
};

export type NormalizedJob = {
  source: JobSource;
  sourceJobId: string | null;
  title: string;
  company: string;
  location: string;
  url: string;
  salary: string | null;
  postedAt: Date | null;
  description: string | null;
};

export interface JobProvider {
  source: JobSource;
  search(input: ProviderSearchInput): Promise<NormalizedJob[]>;
}
