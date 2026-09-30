import type { AiMessage, AiCallResult, AiContent } from "./aiClient";

export class OllamaNotReachableError extends Error {
  constructor(baseUrl: string) {
    super(
      `Couldn't reach a local AI model at ${baseUrl}. Make sure Ollama is installed and running ("ollama serve"), and that you've pulled a model (e.g. "ollama pull llama3.1").`,
    );
    this.name = "OllamaNotReachableError";
  }
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

function toOllamaMessage(role: "user" | "assistant", content: AiMessage["content"]): OllamaMessage {
  if (typeof content === "string") return { role, content };
  const text = (content.filter((c) => c.type === "text") as Extract<AiContent, { type: "text" }>[]).map((c) => c.text).join("\n");
  const images = (content.filter((c) => c.type === "image") as Extract<AiContent, { type: "image" }>[]).map((c) => c.source.data);
  return { role, content: text, images: images.length > 0 ? images : undefined };
}

export interface OllamaCallOptions {
  baseUrl: string;
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
}

/** The free backend for the MFX AI Assistant: a locally-installed Ollama model instead of Anthropic's
 *  paid API. No key needed, nothing leaves the machine — but this is genuinely a lower-quality model
 *  than Claude Sonnet 5 for nuanced pattern analysis, so it's opt-in via Settings, not the default. */
export async function callOllama(options: OllamaCallOptions): Promise<AiCallResult> {
  const body = {
    model: options.model,
    messages: [{ role: "system" as const, content: options.system }, ...options.messages.map((m) => toOllamaMessage(m.role, m.content))],
    stream: false,
    options: { num_predict: options.maxTokens ?? 1024 },
  };

  let response: Response;
  try {
    response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OllamaNotReachableError(options.baseUrl);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Local AI error (${response.status}): ${errBody.slice(0, 300) || `model "${options.model}" may not be installed — try running "ollama pull ${options.model}"`}`,
    );
  }

  const data = await response.json();
  const text: string = data?.message?.content ?? "";
  return { text, toolUses: [], raw: data };
}
