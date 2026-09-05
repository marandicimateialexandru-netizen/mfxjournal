import { callClaude } from "@/features/ai/aiClient";
import type { Trade, PlanningEntry } from "@/db/types";

export interface MindsetCoachResult {
  score: number;
  summary: string;
  insights: string[];
  patterns: { name: string; tone: "positive" | "negative"; description: string }[];
  focus: string;
  watchOuts: string[];
}

const SYSTEM_PROMPT = `You are the MFXJournal Mindset Coach: you analyze a trader's recent trades and journal entries to assess their psychology and behavioral patterns, separate from raw performance.
Respond with ONLY a single JSON object matching exactly this shape, no prose outside the JSON:
{
  "score": <0-100 integer>,
  "summary": "<one sentence on what's driving the score>",
  "insights": ["<3-5 bullet observations connecting behavior to performance>"],
  "patterns": [{"name": "<short pattern name>", "tone": "positive"|"negative", "description": "<2-3 sentences>"}],
  "focus": "<one concrete, prioritized habit to work on this week, explained in a short paragraph>",
  "watchOuts": ["<1-3 warning bullets>"]
}`;

export async function runMindsetCoach(
  apiKey: string | null | undefined,
  recentTrades: Trade[],
  recentEntries: PlanningEntry[],
): Promise<MindsetCoachResult> {
  const payload = {
    recentTrades: recentTrades.slice(-30).map((t) => ({
      date: t.entry_time,
      outcome: t.outcome,
      resultR: t.result_r,
      notes: t.notes,
    })),
    recentEntries: recentEntries.slice(0, 14).map((e) => ({
      date: e.date_start,
      mood: e.mood,
      energy: e.energy,
      confidence: e.confidence,
      journalText: e.journal_text,
    })),
  };

  const result = await callClaude({
    apiKey,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    maxTokens: 1200,
  });

  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Couldn't parse a response from the model.");
  return JSON.parse(match[0]) as MindsetCoachResult;
}
