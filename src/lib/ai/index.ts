import "server-only";
import { anthropicProvider } from "./anthropic";
import { fakeProvider } from "./fake";
import type { AiProvider } from "./types";

export * from "./types";

/**
 * The configured AI provider, or null when AI isn't set up.
 * AI_PROVIDER=fake uses the deterministic test provider; otherwise Claude is
 * used when ANTHROPIC_API_KEY is set.
 */
export function getAi(): AiProvider | null {
  if (process.env.AI_PROVIDER === "fake") return fakeProvider;
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  return null;
}

export const isAiConfigured = () => getAi() !== null;
