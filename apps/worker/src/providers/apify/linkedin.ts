import { JobSource } from "@prisma/client";
import { runActor } from "@/lib/apify";
import { buildNormalizedJob, isNormalizedJob } from "@/lib/normalizeJob";
import type { JobProvider, ProviderSearchInput } from "@/providers/types";

type LinkedInItem = {
  jobId?: string;
  id?: string;
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  jobUrl?: string;
  url?: string;
  salary?: string;
  listedAt?: string;
  postDate?: string;
  description?: string;
};

export class LinkedInProvider implements JobProvider {
  source = JobSource.LINKEDIN;

  async search(input: ProviderSearchInput) {
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID ?? "bebity/linkedin-jobs-scraper";
    const items = await runActor<LinkedInItem>(actorId, {
      searchQuery: input.keyword,
      location: input.location,
      limit: input.maxResults
    });

    return items
      .map((item) =>
        buildNormalizedJob({
          source: this.source,
          sourceJobId: item.jobId ?? item.id,
          title: item.title,
          company: item.companyName ?? item.company,
          location: item.location,
          url: item.jobUrl ?? item.url,
          salary: item.salary,
          postedAt: item.listedAt ?? item.postDate,
          description: item.description
        })
      )
      .filter(isNormalizedJob);
  }
}
