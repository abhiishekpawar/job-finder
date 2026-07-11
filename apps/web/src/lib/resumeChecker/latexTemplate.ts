import { RESUME_LATEX_TEMPLATE } from "@/lib/resumeChecker/resumeTemplateSource";
import type { LatexEdit, SkillRowKey } from "@/lib/resumeChecker/types";

export type { LatexEdit, SkillRowKey };

export function loadResumeTemplate(): string {
  return RESUME_LATEX_TEMPLATE;
}

function escapeLatex(value: string) {
  return value.replace(/([&%$#_{}])/g, "\\$1");
}

const ROW_PATTERNS: Array<{ row: SkillRowKey; match: RegExp }> = [
  { row: "Core Java", match: /^Core Java\s+&/ },
  { row: "Backend", match: /^Backend\s+&/ },
  { row: "Data & Streaming", match: /^Data\s*\\\&\s*Streaming\s+&/ },
  { row: "Databases", match: /^Databases\s+&/ },
  { row: "Cloud & Infra", match: /^Cloud\s*\\\&\s*Infra\s+&/ },
  { row: "Observability", match: /^Observability\s+&/ },
  { row: "Additional", match: /^Additional\s+&/ }
];

const ROW_HINTS: Record<Exclude<SkillRowKey, "Additional">, string[]> = {
  "Core Java": ["java", "jvm", "collections", "streams", "concurrency", "multithreading", "oop"],
  Backend: [
    "spring",
    "webflux",
    "microservices",
    "rest",
    "api",
    "jwt",
    "security",
    "hibernate",
    "jpa",
    "graphql",
    "grpc"
  ],
  "Data & Streaming": [
    "kafka",
    "flink",
    "spark",
    "airflow",
    "streaming",
    "event",
    "rabbitmq",
    "pulsar",
    "kinesis",
    "etl"
  ],
  Databases: ["sql", "mysql", "postgres", "mongo", "redis", "snowflake", "dynamodb", "cassandra", "oracle", "elasticsearch"],
  "Cloud & Infra": [
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "k8s",
    "jenkins",
    "ci/cd",
    "terraform",
    "linux",
    "git",
    "maven",
    "gradle"
  ],
  Observability: ["splunk", "dynatrace", "prometheus", "grafana", "datadog", "elk", "logging", "monitoring", "opentelemetry"]
};

export function guessSkillRow(skill: string): SkillRowKey {
  const lower = skill.toLowerCase();
  for (const [row, hints] of Object.entries(ROW_HINTS) as Array<[Exclude<SkillRowKey, "Additional">, string[]]>) {
    if (hints.some((hint) => lower.includes(hint))) return row;
  }
  return "Additional";
}

function findRowLineIndex(lines: string[], row: SkillRowKey): number {
  const pattern = ROW_PATTERNS.find((item) => item.row === row)?.match;
  if (!pattern) return -1;
  return lines.findIndex((line) => pattern.test(line.trim()));
}

function appendSkillToRowLine(line: string, skill: string): string {
  const escaped = escapeLatex(skill);
  if (line.toLowerCase().includes(skill.toLowerCase())) return line;

  // Observability row often ends without \\[1pt]
  if (/\\\\\s*$/.test(line) || /\\\\\[\d+pt\]\s*$/.test(line)) {
    return line.replace(/(\\\\\s*|\\\\\[\d+pt\]\s*)$/, `, ${escaped}$1`);
  }
  return `${line.replace(/\s+$/, "")}, ${escaped} \\\\`;
}

export function insertMissingSkillsWithEdits(
  latex: string,
  missingSkills: string[],
  placements?: Array<{ skill: string; row: SkillRowKey }>
): { latex: string; edits: LatexEdit[] } {
  const skills = missingSkills.map((s) => s.trim()).filter(Boolean);
  if (!skills.length) return { latex, edits: [] };

  const lines = latex.split("\n");
  const edits: LatexEdit[] = [];
  const placementMap = new Map(
    (placements ?? []).map((item) => [item.skill.toLowerCase(), item.row] as const)
  );

  for (const skill of skills) {
    const alreadyInSkillsTable = lines.some(
      (line) => ROW_PATTERNS.some((pattern) => pattern.match.test(line.trim())) && line.toLowerCase().includes(skill.toLowerCase())
    );
    if (alreadyInSkillsTable) continue;

    const row = placementMap.get(skill.toLowerCase()) ?? guessSkillRow(skill);
    let lineIndex = findRowLineIndex(lines, row);

    if (lineIndex < 0 && row === "Additional") {
      const observabilityIndex = findRowLineIndex(lines, "Observability");
      const insertAt =
        observabilityIndex >= 0 ? observabilityIndex : lines.findIndex((l) => l.includes("\\end{tabularx}"));
      if (insertAt >= 0) {
        const newLine = `Additional       & ${escapeLatex(skill)} \\\\`;
        lines.splice(insertAt, 0, newLine);
        edits.push({
          id: `${skill}-${insertAt}`,
          skill,
          row: "Additional",
          description: `Added new Additional skills row with "${skill}"`,
          lineNumber: insertAt + 1,
          beforeLine: "",
          afterLine: newLine
        });
        continue;
      }
    }

    if (lineIndex < 0) {
      lineIndex = findRowLineIndex(lines, "Backend");
    }
    if (lineIndex < 0) continue;
    if (lines[lineIndex].toLowerCase().includes(skill.toLowerCase())) continue;

    const beforeLine = lines[lineIndex];
    const afterLine = appendSkillToRowLine(beforeLine, skill);
    if (beforeLine === afterLine) continue;

    lines[lineIndex] = afterLine;
    edits.push({
      id: `${skill}-${lineIndex}`,
      skill,
      row,
      description: `Inserted "${skill}" into ${row}`,
      lineNumber: lineIndex + 1,
      beforeLine,
      afterLine
    });
  }

  // Ensure every skill appears somewhere in Technical Skills
  for (const skill of skills) {
    const already = edits.some((edit) => edit.skill.toLowerCase() === skill.toLowerCase());
    if (already) continue;
    if (lines.some((line) => /&\s/.test(line) && line.toLowerCase().includes(skill.toLowerCase()))) continue;

    const observabilityIndex = findRowLineIndex(lines, "Observability");
    const insertAt =
      observabilityIndex >= 0 ? observabilityIndex : lines.findIndex((l) => l.includes("\\end{tabularx}"));
    if (insertAt < 0) continue;

    const existingAdditional = findRowLineIndex(lines, "Additional");
    if (existingAdditional >= 0) {
      const beforeLine = lines[existingAdditional];
      const afterLine = appendSkillToRowLine(beforeLine, skill);
      lines[existingAdditional] = afterLine;
      edits.push({
        id: `${skill}-additional-${existingAdditional}`,
        skill,
        row: "Additional",
        description: `Inserted "${skill}" into Additional`,
        lineNumber: existingAdditional + 1,
        beforeLine,
        afterLine
      });
    } else {
      const newLine = `Additional       & ${escapeLatex(skill)} \\\\`;
      lines.splice(insertAt, 0, newLine);
      edits.push({
        id: `${skill}-additional-new`,
        skill,
        row: "Additional",
        description: `Added Additional row with "${skill}"`,
        lineNumber: insertAt + 1,
        beforeLine: "",
        afterLine: newLine
      });
    }
  }

  return { latex: lines.join("\n"), edits };
}

/** Preserve Font Awesome icons for PDF by using the Tectonic-compatible package. */
export function toCompileSafeLatex(source: string): string {
  let latex = source
    .replace(/\\usepackage\{fontawesome5\}/g, "\\usepackage{fontawesome}")
    .replace(/\\input\{glyphtounicode\}\s*/g, "")
    .replace(/\\pdfgentounicode=1\s*/g, "")
    .replace(/—/g, "---")
    .replace(/–/g, "--")
    .replace(/label=\\textbullet/g, "label=--");

  if (!/\\usepackage\{textcomp\}/.test(latex)) {
    latex = latex.replace(/(\\usepackage\{enumitem\})/, "$1\n\\usepackage{textcomp}");
  }

  return latex;
}
