export type AIChatRole = "system" | "user" | "assistant";

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
};

export type AIChatRequest = {
  systemPrompt?: string;
  messages: AIChatMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AIChatResponse = {
  text: string;
  model: string;
};

export interface AIChatProvider {
  completeChat(input: AIChatRequest): Promise<AIChatResponse>;
}

