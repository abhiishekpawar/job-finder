import type { AiProvider } from "@/lib/resumeChecker/types";
import { AI_TOKEN_STORAGE_KEY } from "@/lib/resumeChecker/types";

export function aiTokenStorageKey(provider: AiProvider) {
  return `${AI_TOKEN_STORAGE_KEY}-${provider}`;
}

export function normalizeAiToken(token: string) {
  return token.trim().replace(/^Bearer\s+/i, "").trim();
}

export function detectAiProvider(token: string): AiProvider | null {
  const value = normalizeAiToken(token);
  if (!value) return null;
  if (value.startsWith("gsk_")) return "groq";
  if (value.startsWith("AIza")) return "gemini";
  return null;
}

export function validateAiToken(provider: AiProvider, token: string): string | null {
  const value = normalizeAiToken(token);
  if (!value) return "Enter your AI token in the token field.";

  if (provider === "groq" && !value.startsWith("gsk_")) {
    return "Groq keys start with gsk_. Paste a Groq API key, or switch provider to Gemini.";
  }

  if (provider === "gemini" && value.startsWith("gsk_")) {
    return "This looks like a Groq key. Switch AI provider to Groq, or paste a Gemini key.";
  }

  if (provider === "gemini" && !value.startsWith("AIza") && value.length < 20) {
    return "Paste a valid Gemini API key from Google AI Studio.";
  }

  return null;
}

export function isAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("401") ||
    lower.includes("permission denied") ||
    lower.includes("api key not valid")
  );
}
