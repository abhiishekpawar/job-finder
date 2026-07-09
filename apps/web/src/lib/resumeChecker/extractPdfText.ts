const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function extractTextFromPdfFile(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("PDF must be 5 MB or smaller.");
  }

  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("Could not extract text from this PDF.");
  }

  return normalized;
}
