const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Add your API key in Settings to enable this.");
    this.name = "AiNotConfiguredError";
  }
}

export interface AiTextContent {
  type: "text";
  text: string;
}

export interface AiImageContent {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

export type AiContent = AiTextContent | AiImageContent;

export interface AiMessage {
  role: "user" | "assistant";
  content: string | AiContent[];
}

export interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AiToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AiCallOptions {
  apiKey: string | null | undefined;
  system: string;
  messages: AiMessage[];
  tools?: AiTool[];
  maxTokens?: number;
}

export interface AiCallResult {
  text: string;
  toolUses: AiToolUse[];
  raw: unknown;
}

export async function callClaude(options: AiCallOptions): Promise<AiCallResult> {
  if (!options.apiKey) throw new AiNotConfiguredError();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens ?? 2048,
      system: options.system,
      messages: options.messages,
      tools: options.tools,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = (data.content ?? []) as Array<Record<string, unknown>>;
  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text as string)
    .join("\n");
  const toolUses = content.filter((c) => c.type === "tool_use") as unknown as AiToolUse[];

  return { text, toolUses, raw: data };
}

export async function testApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    await callClaude({
      apiKey,
      system: "Reply with exactly: ok",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 8,
    });
    return { ok: true, message: "Connection successful." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}
