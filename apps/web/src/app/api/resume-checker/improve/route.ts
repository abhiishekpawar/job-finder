import { NextResponse } from "next/server";
import { z } from "zod";
import { compileLatexToPdf } from "@/lib/resumeChecker/compileLatex";
import { improveResumeLatex } from "@/lib/resumeChecker/improveLatex";
import { loadResumeTemplate } from "@/lib/resumeChecker/latexTemplate";
import { normalizeAiToken, validateAiToken } from "@/lib/resumeChecker/aiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const improveSchema = z.object({
  token: z.string().min(1),
  aiProvider: z.enum(["gemini", "groq"]).default("gemini"),
  jobTitle: z.string().min(1),
  jobDescription: z.string().min(40),
  missingSkills: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  latexSource: z.string().optional()
});

export async function GET() {
  return NextResponse.json({ latex: loadResumeTemplate() });
}

export async function POST(request: Request) {
  try {
    const input = improveSchema.parse(await request.json());

    if (!input.missingSkills.length) {
      return NextResponse.json({ error: "No missing skills to insert." }, { status: 400 });
    }

    const apiKey = normalizeAiToken(input.token);
    const tokenError = validateAiToken(input.aiProvider, apiKey);
    if (tokenError) {
      return NextResponse.json({ error: tokenError }, { status: 401 });
    }

    const improved = await improveResumeLatex({
      missingSkills: input.missingSkills,
      suggestions: input.suggestions,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      provider: input.aiProvider,
      apiKey,
      baseLatex: input.latexSource?.trim() || loadResumeTemplate()
    });

    if (!improved.edits.length) {
      return NextResponse.json(
        { error: "Could not insert skills into the LaTeX template. Skills may already exist." },
        { status: 400 }
      );
    }

    const pdfBuffer = await compileLatexToPdf(improved.latex);
    const pdfBase64 = pdfBuffer.toString("base64");

    return NextResponse.json({
      baseLatex: improved.baseLatex,
      latex: improved.latex,
      edits: improved.edits,
      pdfBase64,
      fileName: "Abhishek_Pawar_Resume_Updated.pdf"
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to improve resume";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
