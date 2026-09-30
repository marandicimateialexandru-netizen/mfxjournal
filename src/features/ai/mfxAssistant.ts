import { callClaudeWithTool, type AiMessage } from "./aiClient";
import { callOllama } from "./localAiClient";
import { callGroqWithTool } from "./groqClient";
import { runQueryTradesTool, QUERY_TRADES_TOOL_NAME, QUERY_TRADES_TOOL_DESCRIPTION, QUERY_TRADES_JSON_SCHEMA, type QueryTradesInput } from "./queryTradesTool";
import type { StatsResult } from "@/features/stats/types";
import type { Trade, CustomResult } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

const SUGGESTIONS_MARKER = "---SUGGESTIONS---";

// A small, fixed-size stand-in for the full (data-dump-sized) system prompt, used only for Groq's
// tool-result follow-up call — see the note on `callGroqWithTool` for why that call can't afford to
// resend the whole compact context a second time within the same 8,000-tokens-per-minute budget.
const GROQ_TOOL_FOLLOW_UP_SYSTEM = `You are the MFX AI Assistant, a trading coach built into MFXJournal. Answer the trader's question using ONLY the live query result given below it — it's exact and computed fresh from their real trades, so cite it directly and don't hedge about data availability. Keep the answer to 2-4 sentences. Then, on its own new line, output exactly this marker followed by a JSON array of exactly 2 short follow-up questions (each under 70 characters):
---SUGGESTIONS---
["...", "..."]
Never skip that block.`;

export interface MfxAssistantReply {
  text: string;
  suggestions: string[];
}

export interface AssistantProviderConfig {
  provider: "claude" | "ollama" | "groq";
  apiKey: string | null | undefined;
  ollamaModel: string;
  ollamaBaseUrl: string;
  groqApiKey: string | null | undefined;
  groqModel: string;
}

export interface AssistantToolContext {
  trades: Trade[];
  variables: VariableWithValues[];
  customResults: CustomResult[];
}

/** Sends one turn to the MFX AI Assistant — via Anthropic's paid API, a free local Ollama model, or
 *  Groq's free cloud API — whichever `provider.provider` says (set in Settings) — and splits the
 *  hidden "---SUGGESTIONS---" control block (a JSON array of follow-up questions the model is
 *  instructed to always append, see `mfxAssistantContext.ts`) out of the visible reply so the UI can
 *  render it as clickable chips instead of raw text. A malformed or missing block degrades gracefully
 *  to no chips, never an error.
 *
 *  Claude and Groq also get a `query_trades` tool (see `queryTradesTool.ts`) so cross-cut questions
 *  the static context doesn't already break out ("which setup wins most at 12:00") get a real,
 *  computed answer instead of "the data doesn't show that." Ollama is skipped — local model function
 *  calling is too inconsistent across models to rely on here, so it stays on the static context only. */
export async function askMfxAssistant(
  provider: AssistantProviderConfig,
  systemPrompt: string,
  history: AiMessage[],
  userContent: AiMessage["content"],
  toolContext: AssistantToolContext,
): Promise<MfxAssistantReply> {
  // Groq's free tier caps at 8,000 tokens per MINUTE total (system + history + response) — a limit
  // Claude and a local Ollama model don't share. Full history would blow through it a couple of turns
  // into any real conversation, so Groq gets only the last exchange for continuity, plus a smaller
  // output budget; the compact system prompt (see `mfxAssistantContext.ts`) covers the rest of the gap.
  const trimmedHistory = provider.provider === "groq" ? history.slice(-2) : history;
  const messages: AiMessage[] = [...trimmedHistory, { role: "user", content: userContent }];

  const executeTool = (name: string, input: Record<string, unknown>) => {
    if (name !== QUERY_TRADES_TOOL_NAME) return { error: "unknown tool" };
    return runQueryTradesTool(input as QueryTradesInput, toolContext.trades, toolContext.variables, toolContext.customResults);
  };

  let result;
  if (provider.provider === "ollama") {
    result = await callOllama({ baseUrl: provider.ollamaBaseUrl, model: provider.ollamaModel, system: systemPrompt, messages, maxTokens: 1600 });
  } else if (provider.provider === "groq") {
    result = await callGroqWithTool({
      apiKey: provider.groqApiKey,
      model: provider.groqModel,
      system: systemPrompt,
      messages,
      maxTokens: 1000,
      tools: [{ name: QUERY_TRADES_TOOL_NAME, description: QUERY_TRADES_TOOL_DESCRIPTION, parameters: QUERY_TRADES_JSON_SCHEMA }],
      followUpSystem: GROQ_TOOL_FOLLOW_UP_SYSTEM,
      executeTool,
    });
  } else {
    result = await callClaudeWithTool({
      apiKey: provider.apiKey,
      system: systemPrompt,
      messages,
      maxTokens: 1600,
      tools: [{ name: QUERY_TRADES_TOOL_NAME, description: QUERY_TRADES_TOOL_DESCRIPTION, input_schema: QUERY_TRADES_JSON_SCHEMA }],
      executeTool,
    });
  }
  return parseReply(result.text);
}

function extractSuggestionsArray(str: string): string[] {
  const match = str.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string").slice(0, 2);
  } catch {
    // Malformed suggestion JSON just means no chips this turn — the visible answer is unaffected.
  }
  return [];
}

// A response that got cut off mid-sentence (the free-tier model ran out of its per-minute token
// budget before reaching the suggestions block, especially deep into a long session) has nothing
// left to extract chips from — but the chat shouldn't just go quiet. These generic fallbacks are
// vague enough to make sense after literally any answer, so the trader always has somewhere to go
// even on the turns where the model's own tailored suggestions never arrived.
const FALLBACK_SUGGESTIONS = ["Can you go deeper on that?", "What's the one thing I should fix first?"];

/** Weaker/free models (Groq's especially) don't always reproduce the literal "---SUGGESTIONS---"
 *  marker even though they reliably still tack a JSON array of questions onto the end — without a
 *  fallback, that array leaks into the chat as raw, ugly text instead of becoming chips. So: try the
 *  marker first (the clean path), and if it's missing, look for a trailing `["...", "..."]` shape at
 *  the very end of the response. If NEITHER produced anything (most often a truncated response that
 *  never got that far), fall back to generic suggestions rather than leaving the chips area empty. */
function parseReply(raw: string): MfxAssistantReply {
  const idx = raw.indexOf(SUGGESTIONS_MARKER);
  if (idx !== -1) {
    const text = raw.slice(0, idx).trim();
    const suggestions = extractSuggestionsArray(raw.slice(idx + SUGGESTIONS_MARKER.length));
    return { text: text || raw.trim(), suggestions: suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS };
  }

  const trimmed = raw.trim();
  const trailingArray = trimmed.match(/(\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\])\s*$/);
  if (trailingArray) {
    const suggestions = extractSuggestionsArray(trailingArray[1]);
    if (suggestions.length > 0) {
      return { text: trimmed.slice(0, trailingArray.index).trim(), suggestions };
    }
  }

  return { text: trimmed, suggestions: FALLBACK_SUGGESTIONS };
}

const STARTER_TEMPLATES: ((s: StatsResult) => string)[] = [
  (s) => `My win rate is ${s.winRatePct.toFixed(0)}% across ${s.totalTrades} trades — what's the one thing that would move it most?`,
  (s) => `I have a profit factor of ${Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "an infinite"} — is that actually good?`,
  () => "Which of my tagged variables is quietly costing me the most R?",
  () => "Looking at my whole journal, what's the biggest mistake I keep repeating?",
  () => "What does my equity curve say about how I handle drawdowns?",
  () => "Walk me through my best day of the week and why it works.",
  () => "If you had to change one habit of mine starting tomorrow, what would it be?",
  () => "Am I overtrading, undertrading, or about right based on my history?",
  (s) => `My max drawdown is ${Math.abs(s.maxDrawdownR).toFixed(1)}R — should that worry me?`,
  () => "What time of day am I actually at my best?",
];

/** Prefills the chat input with a data-aware conversation starter so a blank page never stares back
 *  at the trader — they can hit send as-is, edit it, or ignore it and type their own question. */
export function pickStarterQuestion(stats: StatsResult): string {
  if (stats.totalTrades === 0) return "I haven't logged any trades yet — where should I start?";
  const template = STARTER_TEMPLATES[Math.floor(Math.random() * STARTER_TEMPLATES.length)];
  return template(stats);
}

export function pickStarterAlternatives(stats: StatsResult, exclude: string, count = 3): string[] {
  if (stats.totalTrades === 0) return [];
  const pool = STARTER_TEMPLATES.map((t) => t(stats)).filter((q) => q !== exclude);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
