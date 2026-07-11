import { compile } from "node-latex-compiler";
import { toCompileSafeLatex } from "@/lib/resumeChecker/latexTemplate";

export async function compileLatexToPdf(latex: string): Promise<Buffer> {
  const safe = toCompileSafeLatex(latex);
  const result = await compile({
    tex: safe,
    returnBuffer: true
  });

  if (result.status !== "success" || !result.pdfBuffer) {
    const detail = [result.error, result.stderr, result.stdout].filter(Boolean).join(" | ").slice(0, 500);
    throw new Error(detail || "LaTeX compilation failed");
  }

  return result.pdfBuffer;
}
