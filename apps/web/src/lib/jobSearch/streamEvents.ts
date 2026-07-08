import type { SearchJob } from "./types";

export type ProviderName = "Indeed" | "LinkedIn" | "Naukri" | "Others";

export type SearchStreamEvent =
  | { type: "init"; debug: { keyword: string; location: string; maxResults: number; requestedMaxResults: number } }
  | { type: "provider_start"; provider: ProviderName }
  | { type: "jobs"; provider: ProviderName; items: SearchJob[]; count: number }
  | { type: "provider_error"; provider: ProviderName; message: string }
  | { type: "done"; providerSummary: Record<string, number>; providerErrors: Record<string, string> };

export function encodeSseEvent(event: SearchStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}
