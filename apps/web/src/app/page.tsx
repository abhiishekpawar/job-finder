"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { consumeSearchStream } from "@/lib/jobSearch/consumeSearchStream";
import type { ProviderName } from "@/lib/jobSearch/streamEvents";
import { SOURCE_LABELS, type SearchJob } from "@/lib/jobSearch/types";
import { openResumeChecker } from "@/lib/resumeChecker/storage";
import { TOKEN_STORAGE_KEY } from "@/lib/resumeChecker/types";

type ProviderStatus = "idle" | "running" | "done" | "error";

const PROVIDERS: ProviderName[] = ["Indeed", "LinkedIn", "Naukri", "Others"];

const PROVIDER_STYLES: Record<
  ProviderName,
  { accent: string; badge: string; border: string; subtitle?: string }
> = {
  Indeed: {
    accent: "text-sky-300",
    badge: "bg-sky-400/15 text-sky-200",
    border: "border-sky-400/20"
  },
  LinkedIn: {
    accent: "text-blue-300",
    badge: "bg-blue-400/15 text-blue-200",
    border: "border-blue-400/20"
  },
  Naukri: {
    accent: "text-violet-300",
    badge: "bg-violet-400/15 text-violet-200",
    border: "border-violet-400/20"
  },
  Others: {
    accent: "text-amber-300",
    badge: "bg-amber-400/15 text-amber-200",
    border: "border-amber-400/20",
    subtitle: "Shine, Foundit & more"
  }
};

function emptyJobsByProvider(): Record<ProviderName, SearchJob[]> {
  return { Indeed: [], LinkedIn: [], Naukri: [], Others: [] };
}

function formatPostedDate(value: string | null) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function toPostedTime(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortJobsByNewest(items: SearchJob[]) {
  return [...items].sort((a, b) => toPostedTime(b.postedAt) - toPostedTime(a.postedAt));
}

function JobCard({ job, showSource }: { job: SearchJob; showSource?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-cyan-400/40">
      {showSource ? (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/80">
          {SOURCE_LABELS[job.source]}
        </p>
      ) : null}
      <p className="line-clamp-2 text-sm font-medium text-white">{job.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-300">
        {job.company} • {job.location}
      </p>
      <p className="mt-2 text-xs text-amber-100/90">
        Exp required: {job.experienceRequired ?? "Not specified"}
      </p>
      <p className="mt-1 text-xs text-slate-400">Posted: {formatPostedDate(job.postedAt)}</p>
      {job.salary ? <p className="mt-1 text-xs text-slate-400">{job.salary}</p> : null}

      <div className="mt-3 flex gap-2">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-cyan-400/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-300"
        >
          View job
        </a>
        <button
          type="button"
          onClick={() => openResumeChecker(job)}
          className="rounded-md border border-emerald-400/30 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-300"
        >
          Check resume fit
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [skills, setSkills] = useState("software engineer");
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [location, setLocation] = useState("Bengaluru, India");
  const [maxResults, setMaxResults] = useState<number>(10);
  const [token, setToken] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobsByProvider, setJobsByProvider] = useState<Record<ProviderName, SearchJob[]>>(emptyJobsByProvider);
  const [providerSummary, setProviderSummary] = useState<Record<string, number>>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [providerStatus, setProviderStatus] = useState<Record<ProviderName, ProviderStatus>>({
    Indeed: "idle",
    LinkedIn: "idle",
    Naukri: "idle",
    Others: "idle"
  });
  const [debugInfo, setDebugInfo] = useState<{
    keyword: string;
    location: string;
    maxResults: number;
    requestedMaxResults: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedToken) setToken(savedToken);
    } catch {
      // ignore private browsing / storage errors
    }
  }, []);

  useEffect(() => {
    try {
      const trimmed = token.trim();
      if (trimmed) localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore private browsing / storage errors
    }
  }, [token]);

  const keyword = useMemo(() => skills.trim(), [skills]);

  const totalJobs = useMemo(
    () => PROVIDERS.reduce((sum, name) => sum + jobsByProvider[name].length, 0),
    [jobsByProvider]
  );

  const activeProviders = PROVIDERS.filter((name) => providerStatus[name] === "running").length;

  function resetProviderState() {
    setProviderSummary({});
    setProviderErrors({});
    setProviderStatus({
      Indeed: "running",
      LinkedIn: "running",
      Naukri: "running",
      Others: "running"
    });
  }

  async function runSearch() {
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("Enter your token in the token field.");
      return;
    }

    setError(null);
    setIsSearching(true);
    setJobsByProvider(emptyJobsByProvider());
    resetProviderState();

    const body = { skills, experienceYears, location, keyword, maxResults, token: trimmedToken };

    try {
      const response = await fetch("/api/search/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: abortController.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Search stream failed");
      }

      await consumeSearchStream(response, (event) => {
        switch (event.type) {
          case "init":
            setDebugInfo(event.debug);
            break;
          case "provider_start":
            setProviderStatus((prev) => ({ ...prev, [event.provider]: "running" }));
            break;
          case "jobs":
            setJobsByProvider((prev) => ({ ...prev, [event.provider]: event.items }));
            setProviderSummary((prev) => ({ ...prev, [event.provider]: event.count }));
            setProviderStatus((prev) => ({ ...prev, [event.provider]: "done" }));
            break;
          case "provider_error":
            setProviderErrors((prev) => ({ ...prev, [event.provider]: event.message }));
            setProviderSummary((prev) => ({ ...prev, [event.provider]: 0 }));
            setProviderStatus((prev) => ({ ...prev, [event.provider]: "error" }));
            break;
          case "done":
            setProviderSummary(event.providerSummary);
            setProviderErrors(event.providerErrors);
            break;
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setProviderStatus({
        Indeed: "error",
        LinkedIn: "error",
        Naukri: "error",
        Others: "error"
      });
    } finally {
      if (abortRef.current === abortController) {
        setIsSearching(false);
      }
    }
  }

  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runSearch();
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-cyan-300">On-demand job search</p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Search jobs across sources</h1>
        <p className="mb-6 max-w-xl text-slate-300">
          Search Indeed, LinkedIn, Naukri, and other Indian boards (Shine, Foundit). Enter your details,
          then click Search. Results stream in as each source finishes.
        </p>
        <div className="mb-6">
          <a
            href="/resume-checker"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/20"
          >
            Open Resume Checker
          </a>
        </div>

        <form onSubmit={onSearch} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="token">
              token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="skills">
              Skills / keyword
            </label>
            <input
              id="skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300" htmlFor="exp">
                Experience (years)
              </label>
              <input
                id="exp"
                type="number"
                min={0}
                max={50}
                value={experienceYears}
                onChange={(e) => {
                  const next = e.target.value === "" ? 0 : Number(e.target.value);
                  setExperienceYears(next);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300" htmlFor="location">
                Location
              </label>
              <input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300" htmlFor="maxResults">
                Max results per source
              </label>
              <input
                id="maxResults"
                type="number"
                min={5}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-300">
              <p className="text-slate-400">Search query we send</p>
              <p className="mt-1 font-medium text-white">{keyword}</p>
            </div>
          </div>

          <button
            disabled={isSearching}
            className="w-full cursor-pointer rounded-xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? `Searching (${activeProviders} sources running)...` : "Search"}
          </button>
        </form>

        {error ? <p className="mt-5 text-sm text-rose-300">Error: {error}</p> : null}
        {debugInfo ? (
          <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Debug</p>
            <p className="mt-2">Keyword: {debugInfo.keyword}</p>
            <p>Location: {debugInfo.location}</p>
            <p>Max per source: {debugInfo.maxResults}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Results</h2>
            <p className="mt-1 text-sm text-slate-400">
              {totalJobs > 0
                ? `${totalJobs} jobs found${isSearching ? " (still loading...)" : ""}`
                : isSearching
                  ? "Waiting for first results..."
                  : "Submit the form to search."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROVIDERS.map((name) => {
            const jobs = sortJobsByNewest(jobsByProvider[name]);
            const status = providerStatus[name];
            const styles = PROVIDER_STYLES[name];
            const statusLabel =
              status === "running"
                ? "Searching..."
                : status === "done"
                  ? `${jobs.length} jobs`
                  : status === "error"
                    ? "Failed"
                    : "Waiting";

            return (
              <div
                key={name}
                className={`flex min-h-[360px] flex-col rounded-2xl border bg-slate-900/50 p-4 ${styles.border}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold uppercase tracking-[0.15em] ${styles.accent}`}>
                      {name}
                    </p>
                    {styles.subtitle ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">{styles.subtitle}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-400">{statusLabel}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${styles.badge}`}>
                    {providerSummary[name] ?? jobs.length}
                  </span>
                </div>

                {providerErrors[name] ? (
                  <p className="mb-3 text-xs leading-relaxed text-rose-300">{providerErrors[name]}</p>
                ) : null}

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {jobs.length > 0 ? (
                    jobs.map((job) => (
                      <JobCard key={job.id} job={job} showSource={name === "Others"} />
                    ))
                  ) : status === "running" ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                      Fetching {name} jobs...
                    </div>
                  ) : status === "error" ? (
                    <div className="rounded-xl border border-dashed border-rose-400/20 p-4 text-sm text-slate-400">
                      No jobs from {name}.
                    </div>
                  ) : status === "idle" && !isSearching ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                      Click Search to load jobs.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
