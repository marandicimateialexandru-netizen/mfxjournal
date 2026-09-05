import { callClaude } from "./aiClient";
import type { VariableWithValues } from "@/db/queries/variables";
import type { CustomResult } from "@/db/types";

export interface VoiceFillResult {
  outcome?: string;
  resultR?: number;
  riskR?: number;
  market?: string;
  variableValues?: Record<string, { valueId?: string; numberValue?: number }>;
}

export async function parseVoiceTrade(
  transcript: string,
  ctx: {
    apiKey: string | null | undefined;
    variables: VariableWithValues[];
    customResults: CustomResult[];
  },
): Promise<VoiceFillResult> {
  const variableSchema = ctx.variables.map((v) => ({
    id: v.id,
    label: v.label,
    type: v.type,
    values: v.type === "text" ? v.values.map((val) => ({ id: val.id, label: val.label })) : undefined,
  }));
  const outcomeSchema = [
    { id: "win", label: "Win" },
    { id: "loss", label: "Loss" },
    { id: "be", label: "Break Even" },
    ...ctx.customResults.map((c) => ({ id: c.id, label: c.label })),
  ];

  const system = `You convert a trader's spoken free-form trade description into structured JSON fields for a trade journal entry.
Today's date is ${new Date().toDateString()}.
Available outcomes: ${JSON.stringify(outcomeSchema)}
Available custom variables (match values by label, case-insensitively, and return the value's id): ${JSON.stringify(variableSchema)}

Respond with ONLY a single JSON object, no prose, matching this shape:
{
  "outcome": "<one of the outcome ids above, or omit if not mentioned>",
  "resultR": <number, or omit>,
  "riskR": <number, or omit>,
  "market": "<symbol, or omit>",
  "variableValues": { "<variableId>": { "valueId": "<matched value id>" } | { "numberValue": <number> } }
}`;

  const result = await callClaude({
    apiKey: ctx.apiKey,
    system,
    messages: [{ role: "user", content: transcript }],
    maxTokens: 512,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Couldn't parse a response from the model.");
  return JSON.parse(jsonMatch[0]) as VoiceFillResult;
}
