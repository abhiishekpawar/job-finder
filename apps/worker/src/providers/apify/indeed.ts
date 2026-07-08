import { JobSource } from "@prisma/client";
import { runActor } from "@/lib/apify";
import { buildNormalizedJob, isNormalizedJob } from "@/lib/normalizeJob";
import type { JobProvider, ProviderSearchInput } from "@/providers/types";

type IndeedItem = {
  id?: string;
  jobId?: string;
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  jobLocation?: string;
  salary?: string;
  datePosted?: string;
  postedAt?: string;
  url?: string;
  jobUrl?: string;
  description?: string;
};

export class IndeedProvider implements JobProvider {
  source = JobSource.INDEED;

  async search(input: ProviderSearchInput) {
    const actorId = process.env.APIFY_INDEED_ACTOR_ID ?? "misceres/indeed-scraper";
    const items = await runActor<IndeedItem>(actorId, {
      position: input.keyword,
      country: "India",
      location: input.location,
      maxItems: input.maxResults,
      max_results: input.maxResults,
      query: input.keyword
    });

    return items
      .map((item) =>
        buildNormalizedJob({
          source: this.source,
          sourceJobId: item.jobId ?? item.id,
          title: item.title,
          company: item.companyName ?? item.company,
          location: item.location ?? item.jobLocation,
          url: item.jobUrl ?? item.url,
          salary: item.salary,
          postedAt: item.postedAt ?? item.datePosted,
          description: item.description
        })
      )
      .filter(isNormalizedJob);
  }
}
