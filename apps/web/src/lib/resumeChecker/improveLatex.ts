import { z } from "zod";
import type { AiProvider } from "@/lib/resumeChecker/types";
import { callAiJson } from "@/lib/resumeChecker/aiClient";
import type { LatexEdit, SkillRowKey } from "@/lib/resumeChecker/types";
import {
  guessSkillRow,
  insertMissingSkillsWithEdits,
  loadResumeTemplate
} from "@/lib/resumeChecker/latexTemplate";

const placementSchema = z.object({
  placements: z
    .array(
      z.object({
        skill: z.string(),
        row: z.enum([
          "Core Java",
          "Backend",
          "Data & Streaming",
          "Databases",
          "Cloud & Infra",
          "Observability",
          "Additional"
        ])
      })
    )
    .default([])
});

const SYSTEM_PROMPT = `You place missing resume skills into the correct Technical Skills table row.
Return ONLY valid JSON:
{
  "placements": [{ "skill": string, "row": "Core Java" | "Backend" | "Data & Streaming" | "Databases" | "Cloud & Infra" | "Observability" | "Additional" }]
}
Rules:
- Choose the best matching row for each skill.
- Use Additional only when no other row fits.
- Do not invent skills. Only place the provided skills.`;

async function getPlacements(options: {
  missingSkills: string[];
  jobTitle: string;
  jobDescription: string;
  provider: AiProvider;
  apiKey: string;
}): Promise<Array<{ skill: string; row: SkillRowKey }>> {
  const skills = options.missingSkills.map((s) => s.trim()).filter(Boolean);
  if (!skills.length) return [];

  try {
    const content = await callAiJson({
      provider: options.provider,
      apiKey: options.apiKey,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Job title: ${options.jobTitle}

Job description (for context):
${options.jobDescription.slice(0, 2500)}

Skills to place:
${JSON.stringify(skills)}`
    });

    const parsed = placementSchema.parse(JSON.parse(content));
    return parsed.placements.map((item) => ({
      skill: item.skill,
      row: item.row
    }));
  } catch {
    return skills.map((skill) => ({ skill, row: guessSkillRow(skill) }));
  }
}

export async function improveResumeLatex(options: {
  missingSkills: string[];
  suggestions: string[];
  jobTitle: string;
  jobDescription: string;
  provider: AiProvider;
  apiKey: string;
  baseLatex?: string;
}): Promise<{ latex: string; edits: LatexEdit[]; baseLatex: string }> {
  const baseLatex = options.baseLatex?.trim() || loadResumeTemplate();
  const skills = options.missingSkills.map((s) => s.trim()).filter(Boolean);

  if (!skills.length) {
    return { latex: baseLatex, edits: [], baseLatex };
  }

  const placements = await getPlacements({
    missingSkills: skills,
    jobTitle: options.jobTitle,
    jobDescription: options.jobDescription,
    provider: options.provider,
    apiKey: options.apiKey
  });

  const { latex, edits } = insertMissingSkillsWithEdits(baseLatex, skills, placements);
  return { latex, edits, baseLatex };
}
