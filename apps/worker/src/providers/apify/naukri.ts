import { JobSource } from "@prisma/client";
import { runActor } from "@/lib/apify";
import { buildNormalizedJob, isNormalizedJob } from "@/lib/normalizeJob";
import type { JobProvider, ProviderSearchInput } from "@/providers/types";

type NaukriItem = {
  jobId?: string;
  id?: string;
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  placeholders?: string[];
  salary?: string;
  postedAt?: string;
  createdAt?: string;
  jobUrl?: string;
  url?: string;
  description?: string;
};

export class NaukriProvider implements JobProvider {
  source = JobSource.NAUKRI;

  async search(input: ProviderSearchInput) {
    const actorId = process.env.APIFY_NAUKRI_ACTOR_ID ?? "codingfrontend/naukri-jobs-scraper";
    const items = await runActor<NaukriItem>(actorId, {
      keywords: input.keyword,
      keyword: input.keyword,
      location: input.location,
      maxItems: input.maxResults,
      deepSearch: true
    });

    return items
      .map((item) =>
        buildNormalizedJob({
          source: this.source,
          sourceJobId: item.jobId ?? item.id,
          title: item.title,
          company: item.companyName ?? item.company,
          location: item.location ?? item.placeholders?.join(", "),
          url: item.jobUrl ?? item.url,
          salary: item.salary,
          postedAt: item.postedAt ?? item.createdAt,
          description: item.description
        })
      )
      .filter(isNormalizedJob);
  }
}
