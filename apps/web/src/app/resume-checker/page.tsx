"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AiProvider, ResumeAnalysisResult } from "@/lib/resumeChecker/types";
import {
  AI_PROVIDER_STORAGE_KEY,
  AI_TOKEN_STORAGE_KEY
} from "@/lib/resumeChecker/types";
import {
  loadResumeCheckerJob,
  resumeContextFromSearchParams
} from "@/lib/resumeChecker/storage";

function scoreStyles(score: number) {
  if (score >= 75) {
    return {
      ring: "border-emerald-400/40",
      text: "text-emerald-300",
      badge: "bg-emerald-500/15 text-emerald-200",
      label: "Good match"
    };
  }
  if (score >= 55) {
    return {
      ring: "border-amber-400/40",
      text: "text-amber-300",
      badge: "bg-amber-500/15 text-amber-200",
      label: "Needs improvements"
    };
  }
  return {
    ring: "border-rose-400/40",
    text: "text-rose-300",
    badge: "bg-rose-500/15 text-rose-200",
    label: "Low match"
  };
}

function ResumeCheckerContent() {
  const searchParams = useSearchParams();
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [requiredYears, setRequiredYears] = useState(0);
  const [resumeText, setResumeText] = useState("");
  const [source, setSource] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");

  const [token, setToken] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(AI_TOKEN_STORAGE_KEY);
      if (savedToken) setToken(savedToken);

      const savedProvider = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
      if (savedProvider === "gemini" || savedProvider === "groq") {
        setAiProvider(savedProvider);
      }
    } catch {
      // ignore private browsing / storage errors
    }
  }, []);

  useEffect(() => {
    try {
      const trimmed = token.trim();
      if (trimmed) localStorage.setItem(AI_TOKEN_STORAGE_KEY, trimmed);
      else localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
      localStorage.setItem(AI_PROVIDER_STORAGE_KEY, aiProvider);
    } catch {
      // ignore private browsing / storage errors
    }
  }, [token, aiProvider]);

  useEffect(() => {
    const prefill = searchParams.get("prefill") === "1";
    const fromUrl = resumeContextFromSearchParams(searchParams);
    const fromStorage = prefill ? loadResumeCheckerJob() : null;
    const job = fromStorage ?? fromUrl;

    if (!job) return;

    setJobTitle(job.jobTitle);
    setJobDescription(job.jobDescription);
    setRequiredYears(job.requiredYears);
    setSource(job.source);
    setJobUrl(job.jobUrl);
    setCompany(job.company);
    setLocation(job.location);
  }, [searchParams]);

  useEffect(() => {
    if (!jobTitle || !jobUrl) return;
    if (jobDescription && jobDescription.length > 120) return;

    let cancelled = false;
    setLoadingDescription(true);
    fetch("/api/resume-checker/description", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, jobUrl, jobTitle, company, location })
    })
      .then((response) => response.json())
      .then((data: { description?: string }) => {
        if (cancelled) return;
        if (data.description && data.description.length > 120) {
          setJobDescription(data.description);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDescription(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, jobUrl, jobTitle, company, location, jobDescription]);

  async function onResumePdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("PDF must be 5 MB or smaller.");
      return;
    }

    setError(null);
    setResult(null);
    setParsingPdf(true);
    setResumeFileName(file.name);

    try {
      const { extractTextFromPdfFile } = await import("@/lib/resumeChecker/extractPdfText");
      const text = await extractTextFromPdfFile(file);
      if (text.length < 80) {
        throw new Error(
          "Could not extract enough text from this PDF. Try a text-based PDF or paste your resume."
        );
      }
      setResumeText(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read PDF";
      setError(message);
      setResumeFileName("");
      setResumeText("");
    } finally {
      setParsingPdf(false);
    }
  }

  async function onAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("Enter your token in the token field.");
      return;
    }

    if (resumeText.trim().length < 80) {
      setError("Upload a PDF resume or paste at least 80 characters of resume text.");
      return;
    }

    setAnalyzing(true);

    try {
      const response = await fetch("/api/resume-checker/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          jobDescription,
          requiredYears,
          resumeText,
          token: trimmedToken,
          aiProvider
        })
      });

      const data = (await response.json()) as ResumeAnalysisResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Resume analysis failed");
      }

      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resume analysis failed";
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  }

  const styles = scoreStyles(result?.score ?? 0);

  return (
    <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-emerald-300">AI resume checker</p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Check your resume for a specific job</h1>
        <p className="mb-6 text-slate-300">
          AI evaluates skills, experience, and role fit against the full job description, then gives a score and
          concrete resume edits.
        </p>

        <form className="space-y-5" onSubmit={onAnalyze}>
          <div className="grid gap-5 md:grid-cols-[1fr_180px]">
            <div>
              <label className="mb-2 block text-sm text-slate-300" htmlFor="token">
                token
              </label>
              <input
                id="token"
                name="token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300" htmlFor="aiProvider">
                AI provider
              </label>
              <select
                id="aiProvider"
                value={aiProvider}
                onChange={(event) => setAiProvider(event.target.value as AiProvider)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              >
                <option value="gemini">Gemini (free)</option>
                <option value="groq">Groq (free)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="jobTitle">
              Job title
            </label>
            <input
              id="jobTitle"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="requiredYears">
              Required years of experience
            </label>
            <input
              id="requiredYears"
              type="number"
              min={0}
              max={30}
              value={requiredYears}
              onChange={(event) => setRequiredYears(Number(event.target.value) || 0)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="jobDescription">
              Job description
            </label>
            {loadingDescription ? (
              <p className="mb-2 text-xs text-cyan-200">Fetching full job description...</p>
            ) : null}
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              required
              rows={8}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="resumePdf">
              Resume (PDF)
            </label>
            <input
              id="resumePdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onResumePdfChange}
              disabled={parsingPdf || analyzing}
              className="block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-400 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {parsingPdf ? (
              <p className="mt-2 text-xs text-cyan-200">Reading PDF and extracting text...</p>
            ) : resumeFileName ? (
              <p className="mt-2 text-xs text-slate-400">Loaded: {resumeFileName}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Upload a text-based PDF resume (max 5 MB).</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="resumeText">
              Extracted resume text
            </label>
            <textarea
              id="resumeText"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              rows={12}
              placeholder="Upload a PDF above, or paste your resume text here."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <button
            disabled={analyzing || parsingPdf}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
          >
            {analyzing ? "Analyzing with AI..." : "Check resume match"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-300">Error: {error}</p> : null}
      </div>

      <div className={`rounded-3xl border bg-slate-950/70 p-8 ${styles.ring}`}>
        <h2 className="mb-4 text-xl font-semibold text-white">AI match result</h2>

        {result ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <p className={`text-sm uppercase tracking-[0.18em] ${styles.text}`}>{styles.label}</p>
              <p className="mt-2 text-4xl font-bold text-white">{result.score}%</p>
              <p className="mt-2 text-sm text-slate-300">{result.summary}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <p className="text-sm font-medium text-white">Strengths</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {result.strengths.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            {result.gaps.length ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
                <p className="text-sm font-medium text-white">Gaps</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {result.gaps.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <p className="text-sm font-medium text-white">Suggested resume changes</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {result.suggestions.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            {result.missingSkills.length ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
                <p className="text-sm font-medium text-white">Missing skills to add</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.missingSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
            Upload your resume PDF and click <span className="text-white">Check resume match</span> to run AI
            analysis.
          </div>
        )}
      </div>
    </section>
  );
}

export default function ResumeCheckerPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          Loading resume checker...
        </div>
      }
    >
      <ResumeCheckerContent />
    </Suspense>
  );
}
