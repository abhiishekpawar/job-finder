import { toCompileSafeLatex } from "@/lib/resumeChecker/latexTemplate";

const YTOTECH_COMPILE_URL = "https://latex.ytotech.com/builds/sync";

function isPdfBuffer(buffer: Buffer) {
  return buffer.length > 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF";
}

function shouldSkipLocalTectonic() {
  // Render (and many cloud hosts) ship older glibc than recent tectonic binaries need.
  return Boolean(process.env.RENDER || process.env.LATEX_FORCE_HTTP === "1");
}

async function compileWithTectonic(safeLatex: string): Promise<Buffer> {
  const { compile } = await import("node-latex-compiler");
  const result = await compile({
    tex: safeLatex,
    returnBuffer: true
  });

  if (result.status !== "success" || !result.pdfBuffer) {
    const detail = [result.error, result.stderr, result.stdout].filter(Boolean).join(" | ").slice(0, 500);
    throw new Error(detail || "Local LaTeX compilation failed");
  }

  return Buffer.from(result.pdfBuffer);
}

async function compileWithHttpApi(safeLatex: string): Promise<Buffer> {
  const response = await fetch(YTOTECH_COMPILE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      compiler: "pdflatex",
      resources: [
        {
          main: true,
          content: safeLatex
        }
      ]
    })
  });

  const bytes = Buffer.from(await response.arrayBuffer());

  // ytotech returns 201 Created with a PDF body on success.
  if (!(response.status === 200 || response.status === 201) || !isPdfBuffer(bytes)) {
    const message = bytes.toString("utf8").slice(0, 500) || `HTTP compile failed (${response.status})`;
    throw new Error(message);
  }

  return bytes;
}

export async function compileLatexToPdf(latex: string): Promise<Buffer> {
  const safe = toCompileSafeLatex(latex);
  const errors: string[] = [];

  if (!shouldSkipLocalTectonic()) {
    try {
      return await compileWithTectonic(safe);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`local: ${message}`);
      // Continue to HTTP fallback (covers glibc mismatches too).
    }
  }

  try {
    return await compileWithHttpApi(safe);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`http: ${message}`);
    throw new Error(`LaTeX compilation failed. ${errors.join(" | ")}`.slice(0, 700));
  }
}
