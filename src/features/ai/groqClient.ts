import type { AiMessage, AiCallResult, AiContent } from "./aiClient";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("Add your free Groq API key in Settings to enable this.");
    this.name = "GroqNotConfiguredError";
  }
}

/** Groq's free tier hands back a 429 with the exact wait time in its error message ("Please try
 *  again in 5.94s") whenever the rolling 8,000-tokens-per-minute budget is momentarily exhausted —
 *  which happens routinely in normal back-and-forth use, not just abuse. Rather than surface that as
 *  an error, every call through here waits out the suggested delay and retries automatically, so a
 *  429 is invisible to the trader: the reply just takes a couple of seconds longer. */
async function postToGroq(apiKey: string, body: unknown, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (response.status !== 429 || attempt >= maxRetries) return response;
    const text = await response.clone().text().catch(() => "");
    const match = text.match(/try again in ([\d.]+)s/i);
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 300 : 2500;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

type GroqContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function toGroqMessage(role: "user" | "assistant", content: AiMessage["content"]): { role: string; content: string | GroqContentPart[] } {
  if (typeof content === "string") return { role, content };
  const parts: GroqContentPart[] = content.map((c: AiContent) =>
    c.type === "text" ? { type: "text", text: c.text } : { type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } },
  );
  return { role, content: parts };
}

export interface GroqCallOptions {
  apiKey: string | null | undefined;
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
}

/** Groq's API is OpenAI-compatible (chat/completions shape), so this is a small adapter rather than a
 *  clone of `aiClient.ts` — it's a free, cloud-hosted backend for the MFX AI Assistant: no local
 *  install like Ollama, no per-use cost like Anthropic, just a one-time free API key from
 *  console.groq.com. */
export async function callGroq(options: GroqCallOptions): Promise<AiCallResult> {
  if (!options.apiKey) throw new GroqNotConfiguredError();

  const response = await postToGroq(options.apiKey, {
    model: options.model,
    max_tokens: options.maxTokens ?? 1600,
    messages: [{ role: "system", content: options.system }, ...options.messages.map((m) => toGroqMessage(m.role, m.content))],
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return { text, toolUses: [], raw: data };
}

export interface GroqTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

function extractText(content: AiMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((c): c is Extract<AiContent, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/** Runs Groq through one round of tool use (OpenAI-style function calling). The follow-up call
 *  deliberately does NOT replay the full (data-dump-sized) system prompt or any history a second
 *  time — Groq's free tier caps at 8,000 tokens per MINUTE across ALL requests, so two full-context
 *  calls back to back for one turn would eat most of that budget on its own. Instead it gets
 *  `followUpSystem` (a small, fixed-size instruction, not the whole context) plus the original
 *  question and the tool's result — enough for a short, correct final answer at a fraction of the cost. */
export async function callGroqWithTool(
  options: GroqCallOptions & { tools: GroqTool[]; followUpSystem: string; executeTool: (name: string, input: Record<string, unknown>) => unknown },
): Promise<AiCallResult> {
  if (!options.apiKey) throw new GroqNotConfiguredError();

  const toolDefs = options.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const first = await postToGroq(options.apiKey, {
    model: options.model,
    max_tokens: options.maxTokens ?? 1000,
    messages: [{ role: "system", content: options.system }, ...options.messages.map((m) => toGroqMessage(m.role, m.content))],
    tools: toolDefs,
  });
  if (!first.ok) {
    const body = await first.text().catch(() => "");
    throw new Error(`Groq API error (${first.status}): ${body.slice(0, 300)}`);
  }
  const firstData = await first.json();
  const message = firstData?.choices?.[0]?.message;
  const toolCalls = message?.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;

  if (!toolCalls || toolCalls.length === 0) {
    return { text: message?.content ?? "", toolUses: [], raw: firstData };
  }

  const call = toolCalls[0];
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(call.function.arguments);
  } catch {
    // Malformed tool arguments — proceed with an empty input rather than failing the whole turn.
  }
  const toolResult = options.executeTool(call.function.name, input);
  const lastQuestion = extractText(options.messages[options.messages.length - 1]?.content ?? "");

  const second = await postToGroq(options.apiKey, {
    model: options.model,
    max_tokens: options.maxTokens ?? 1000,
    messages: [
      { role: "system", content: options.followUpSystem },
      { role: "user", content: `${lastQuestion}\n\n(Live query result for this exact question: ${JSON.stringify(toolResult)})` },
    ],
  });
  if (!second.ok) {
    const body = await second.text().catch(() => "");
    throw new Error(`Groq API error (${second.status}): ${body.slice(0, 300)}`);
  }
  const secondData = await second.json();
  return { text: secondData?.choices?.[0]?.message?.content ?? "", toolUses: [], raw: secondData };
}

export async function testGroqKey(apiKey: string, model: string): Promise<{ ok: boolean; message: string }> {
  try {
    await callGroq({ apiKey, model, system: "Reply with exactly: ok", messages: [{ role: "user", content: "ping" }], maxTokens: 8 });
    return { ok: true, message: "Connection successful." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}
