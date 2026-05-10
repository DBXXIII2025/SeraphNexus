import type { AIChatProvider, AIChatRequest, AIChatResponse } from "@/lib/ai/types";

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

export class GeminiConfigurationError extends Error {}

export class GeminiProvider implements AIChatProvider {
  async completeChat(input: AIChatRequest): Promise<AIChatResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || input.model || "gemini-2.5-flash";

    if (!apiKey) {
      throw new GeminiConfigurationError(
        "The AI assistant is not configured yet. Add GEMINI_API_KEY on the server."
      );
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = input.messages
      .filter((message) => message.role !== "system" && message.content.trim())
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content.trim() }],
      }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: input.systemPrompt?.trim()
          ? {
              parts: [{ text: input.systemPrompt.trim() }],
            }
          : undefined,
        contents,
        generationConfig: {
          temperature: input.temperature ?? 0.4,
          maxOutputTokens: input.maxOutputTokens ?? 700,
        },
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;

    if (!response.ok) {
      throw new Error(
        payload?.error?.message || "The AI assistant could not reach Gemini right now."
      );
    }

    if (payload?.promptFeedback?.blockReason) {
      throw new Error("The AI assistant could not answer that request safely.");
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => String(part.text || ""))
      .join("")
      .trim();

    if (!text) {
      throw new Error("The AI assistant returned an empty response.");
    }

    return {
      text,
      model,
    };
  }
}

