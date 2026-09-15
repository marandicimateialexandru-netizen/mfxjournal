import type { TemplateData } from "@/db/types";

/**
 * The user's real trading variable taxonomy. Ships as the seed data for a fresh workspace
 * (see db/seed.ts) instead of a generic placeholder set. Order matters — it mirrors the exact
 * order the user tracks these in, both for the variables themselves and the values within each.
 */
export const PERSONAL_VARIABLE_SET: TemplateData = {
  variables: [
    {
      key: "direction",
      label: "Direction",
      type: "text",
      icon: "🧭",
      values: [
        { label: "Buy", icon: "🟢" },
        { label: "Sell", icon: "🔴" },
      ],
    },
    {
      key: "displacement",
      label: "Displacement",
      type: "text",
      icon: "📏",
      values: [
        { label: "Foarte bun", icon: "🟢" },
        { label: "Bun", icon: "🟡" },
        { label: "Decent", icon: "🟠" },
        { label: "Slab", icon: "⚪" },
      ],
    },
    {
      key: "fvg_size",
      label: "Fvg Size",
      type: "text",
      icon: "📐",
      values: [
        { label: "0.5-1", icon: "·" },
        { label: "1-1.5", icon: "•" },
        { label: "1.5-2", icon: "●" },
        { label: "2-2.5", icon: "⚫" },
        { label: "2.5-3", icon: "⬤" },
        { label: "3-3.5", icon: "🔴" },
        { label: "3.5-4", icon: "🟠" },
        { label: "4.5-5", icon: "🟡" },
        { label: "5-10", icon: "⭕" },
      ],
    },
    {
      key: "liquidity",
      label: "Liquidity",
      type: "text",
      icon: "💧",
      values: [
        { label: "Majora", icon: "♦️" },
        { label: "HOD", icon: "🔺" },
        { label: "LOD", icon: "🔻" },
        { label: "Locala", icon: "○" },
        { label: "Minora", icon: "◇" },
      ],
    },
    {
      key: "mss",
      label: "Mss",
      type: "text",
      icon: "⚡",
      values: [
        { label: "Normal", icon: "○" },
        { label: "Agresiv", icon: "●" },
      ],
    },
    {
      key: "news",
      label: "News",
      type: "text",
      icon: "📰",
      values: [
        { label: "No News", icon: "○" },
        { label: "German GDP", icon: "•" },
        { label: "German CPI", icon: "•" },
        { label: "EUR CPI", icon: "•" },
        { label: "UK GDP", icon: "•" },
        { label: "US CPI", icon: "•" },
        { label: "US PPI", icon: "•" },
        { label: "US Bank Holiday", icon: "•" },
        { label: "FOMC", icon: "•" },
        { label: "Fed Speech", icon: "•" },
        { label: "Trump Speech", icon: "•" },
        { label: "Crude Oil Inventories", icon: "•" },
      ],
    },
    {
      key: "session",
      label: "Session",
      type: "text",
      icon: "🕐",
      values: [
        { label: "Dimineață", icon: "◐" },
        { label: "Zi", icon: "○" },
        { label: "Seară", icon: "●" },
      ],
    },
    {
      key: "setup",
      label: "Setup",
      type: "text",
      icon: "🎯",
      values: [
        { label: "OSG", icon: "🎯" },
        { label: "TG", icon: "🎯" },
        { label: "TCG", icon: "🎯" },
        { label: "3G", icon: "🎯" },
        { label: "3CG", icon: "🎯" },
        { label: "SLG+OG", icon: "🎯" },
        { label: "SLG+TG", icon: "🎯" },
        { label: "SLG+TCG", icon: "🎯" },
        { label: "SLG+3G", icon: "🎯" },
        { label: "SLG+3CG", icon: "🎯" },
      ],
    },
    {
      key: "trend",
      label: "Trend",
      type: "text",
      icon: "📈",
      values: [
        { label: "Together", icon: "✅" },
        { label: "Against", icon: "❌" },
        { label: "No Trend", icon: "➖" },
      ],
    },
    {
      key: "ath",
      label: "Ath",
      type: "text",
      icon: "🏔️",
      values: [
        { label: "0-0.5%", icon: "📈" },
        { label: "0.5-1%", icon: "📈" },
        { label: "1-1.5%", icon: "📈" },
        { label: "1.5-2%", icon: "📈" },
        { label: ">2", icon: "📈" },
      ],
    },
  ],
};
