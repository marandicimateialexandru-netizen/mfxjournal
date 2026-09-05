import type { AiTool } from "./aiClient";
import type { VariableWithValues } from "@/db/queries/variables";
import type { CustomResult } from "@/db/types";

export function buildTaskAssistantTools(
  variables: VariableWithValues[],
  customResults: CustomResult[],
): AiTool[] {
  const outcomeIds = ["win", "loss", "be", ...customResults.map((c) => c.id)];

  return [
    {
      name: "create_trade",
      description:
        "Propose a new trade entry. This does NOT save the trade — it opens a pre-filled form for the user to review and confirm.",
      input_schema: {
        type: "object",
        properties: {
          entry_time_iso: { type: "string", description: "ISO 8601 datetime" },
          outcome: { type: "string", enum: outcomeIds },
          result_r: { type: "number" },
          risk_r: { type: "number" },
          market: { type: "string" },
          notes: { type: "string" },
          variableValues: {
            type: "object",
            description: `Keyed by variable id. Available variables: ${JSON.stringify(
              variables.map((v) => ({ id: v.id, label: v.label, type: v.type, values: v.values.map((val) => ({ id: val.id, label: val.label })) })),
            )}`,
          },
        },
        required: ["entry_time_iso", "outcome", "result_r"],
      },
    },
    {
      name: "create_variable",
      description:
        "Propose a new custom Variable (a tag category) for trades, optionally with its first value. Requires user confirmation before creating.",
      input_schema: {
        type: "object",
        properties: {
          label: { type: "string" },
          type: { type: "string", enum: ["text", "number"] },
          icon: { type: "string", description: "A single emoji" },
          firstValue: { type: "string" },
        },
        required: ["label", "type"],
      },
    },
    {
      name: "create_planning_entry",
      description: "Propose a new Planning journal entry. Requires user confirmation before creating.",
      input_schema: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
          date_start_iso: { type: "string" },
          title: { type: "string" },
          mood: { type: "number", minimum: 1, maximum: 5 },
          energy: { type: "number", minimum: 1, maximum: 5 },
          confidence: { type: "number", minimum: 1, maximum: 5 },
          journal_text: { type: "string" },
        },
        required: ["period", "date_start_iso", "journal_text"],
      },
    },
  ];
}
