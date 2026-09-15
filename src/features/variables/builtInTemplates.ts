import type { TemplateData } from "@/db/types";

/** Ships with every install so "Apply Template" is never empty on a fresh workspace. */
export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  data: TemplateData;
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: "builtin-trading-institutional",
    name: "Trading Institutional (Default)",
    description: "A common ICT/SMC-style variable set: setup, session, emotion, mistake and risk tracking.",
    data: {
      variables: [
        {
          key: "setup",
          label: "Setup",
          type: "text",
          icon: "🎯",
          values: [
            { label: "Silver Bullet", icon: "🥈" },
            { label: "Order Block", icon: "🧱" },
            { label: "Fair Value Gap", icon: "📐" },
            { label: "Liquidity Sweep", icon: "🌊" },
            { label: "Breaker", icon: "⚡" },
          ],
        },
        {
          key: "session",
          label: "Session",
          type: "text",
          icon: "🕐",
          values: [
            { label: "Asian", icon: "🌙" },
            { label: "London", icon: "🇬🇧" },
            { label: "New York", icon: "🗽" },
            { label: "London Close", icon: "🌇" },
          ],
        },
        {
          key: "emotion",
          label: "Emotion",
          type: "text",
          icon: "🧠",
          values: [
            { label: "Calm", icon: "🧘" },
            { label: "Confident", icon: "😎" },
            { label: "FOMO", icon: "😱" },
            { label: "Anxious", icon: "😰" },
            { label: "Revenge", icon: "😡" },
          ],
        },
        {
          key: "mistake",
          label: "Mistake",
          type: "text",
          icon: "⚠️",
          values: [
            { label: "None", icon: "✅" },
            { label: "Early Entry", icon: "⏱️" },
            { label: "Moved Stop Loss", icon: "🔀" },
            { label: "Oversized", icon: "📈" },
            { label: "Chased Price", icon: "🏃" },
          ],
        },
        {
          key: "risk_percent",
          label: "Risk %",
          type: "number",
          icon: "⚖️",
          values: [],
        },
      ],
    },
  },
];
