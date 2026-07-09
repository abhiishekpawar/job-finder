import { NextResponse } from "next/server";
import { z } from "zod";
import type { AiProvider } from "@/lib/resumeChecker/types";
import type { ResumeAnalysisResult } from "@/lib/resumeChecker/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const analyzeSchema = z.object({
  jobTitle: z.string().min(1),
  jobDescription: z.string().min(40),
  requiredYears: z.number().int().min(0).max(40),
  resumeText: z.string().min(80),
  token: z.string().optional(),
  aiProvider: z.enum(["gemini", "groq"]).optional()
});

type AnalyzeInput = z.infer<typeof analyzeSchema>;

const analysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(["good_match", "needs_improvement", "low_match"]),
  summary: z.string().min(1),
  strengths: z.array(z.string()).min(1).max(8),
  gaps: z.array(z.string()).max(8),
  suggestions: z.array(z.string()).min(1).max(8),
  missingSkills: z.array(z.string()).max(12)
});

const SYSTEM_PROMPT = `You are an expert technical recruiter and resume coach.
Evaluate how well a resume matches a specific job.
Return ONLY valid JSON with this exact shape:
{
  "score": number (0-100),
  "verdict": "good_match" | "needs_improvement" | "low_match",
  "summary": string,
  "strengths": string[],
  "gaps": string[],
  "suggestions": string[],
  "missingSkills": string[]
}
Scoring guide:
- 80-100: strong fit, likely interview-ready with minor edits
- 60-79: decent fit, needs targeted resume updates
- 0-59: weak fit, major changes needed
Be specific, practical, and grounded in the provided texts.`;

function buildUserPrompt(input: AnalyzeInput) {
  return `Job title: ${input.jobTitle}
Required experience (years): ${input.requiredYears}

Job description:
${input.jobDescription}

Resume:
${input.resumeText}`;
}

function parseAnalysisContent(content: string): ResumeAnalysisResult {
  return analysisResponseSchema.parse(JSON.parse(content));
}

function fallbackAnalysis(jobTitle: string, requiredYears: number, resumeText: string): ResumeAnalysisResult {
  const resumeLower = resumeText.toLowerCase();
  const titleTokens = jobTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const matched = titleTokens.filter((token) => resumeLower.includes(token));
  const coverage = titleTokens.length ? matched.length / titleTokens.length : 0;
  const score = Math.round(40 + coverage * 60);

  return {
    score,
    verdict: score >= 75 ? "good_match" : score >= 55 ? "needs_improvement" : "low_match",
    summary: "Enter your token in the token field to run full AI analysis.",
    strengths: matched.length ? [`Resume mentions role terms like: ${matched.join(", ")}.`] : ["Resume has usable content for review."],
    gaps: ["Full AI analysis could not run."],
    suggestions: [
      "Align your summary and skills section to this job title.",
      requiredYears > 0
        ? `Highlight ${requiredYears}+ years of relevant experience with measurable outcomes.`
        : "Add project outcomes with metrics (latency, revenue, users, cost).",
      "Mirror important tools and responsibilities from the job description."
    ],
    missingSkills: []
  };
}

async function analyzeWithGemini(input: AnalyzeInput, apiKey: string): Promise<ResumeAnalysisResult> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned empty content");

  return parseAnalysisContent(content);
}

async function analyzeWithGroq(input: AnalyzeInput, apiKey: string): Promise<ResumeAnalysisResult> {
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Groq failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content");

  return parseAnalysisContent(content);
}

function resolveApiKey(requestToken?: string): string | null {
  const fromRequest = requestToken?.trim();
  if (fromRequest) return fromRequest;

  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  );
}

function resolveProvider(input: AnalyzeInput, apiKey: string): AiProvider {
  if (input.aiProvider) return input.aiProvider;
  if (process.env.GEMINI_API_KEY?.trim() === apiKey) return "gemini";
  if (process.env.GROQ_API_KEY?.trim() === apiKey) return "groq";
  if (apiKey.startsWith("gsk_")) return "groq";
  return "gemini";
}

async function analyzeWithAi(input: AnalyzeInput): Promise<ResumeAnalysisResult> {
  const apiKey = resolveApiKey(input.token);
  if (!apiKey) {
    return fallbackAnalysis(input.jobTitle, input.requiredYears, input.resumeText);
  }

  const provider = resolveProvider(input, apiKey);
  if (provider === "groq") {
    return analyzeWithGroq(input, apiKey);
  }
  return analyzeWithGemini(input, apiKey);
}

export async function POST(request: Request) {
  try {
    const input = analyzeSchema.parse(await request.json());

    if (!resolveApiKey(input.token)) {
      return NextResponse.json(
        { error: "Enter your token in the token field." },
        { status: 400 }
      );
    }

    try {
      const result = await analyzeWithAi(input);
      return NextResponse.json(result);
    } catch (aiError) {
      const fallback = fallbackAnalysis(input.jobTitle, input.requiredYears, input.resumeText);
      const reason = aiError instanceof Error ? aiError.message : "AI service unavailable";
      return NextResponse.json({
        ...fallback,
        summary: `${fallback.summary} (${reason})`
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume analysis failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
