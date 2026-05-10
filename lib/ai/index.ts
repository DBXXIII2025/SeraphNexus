import { GeminiProvider } from "@/lib/ai/providers/gemini";
import type { AIChatProvider } from "@/lib/ai/types";

export function getAIChatProvider(): AIChatProvider {
  return new GeminiProvider();
}

export * from "@/lib/ai/types";
export * from "@/lib/ai/providers/gemini";

