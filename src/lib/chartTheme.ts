import type { CSSProperties } from "react";

/** Shared Recharts <Tooltip> styling — contentStyle alone only themes the wrapper box,
 *  not the text inside it, which otherwise falls back to Recharts' hardcoded black. */
export const tooltipContentStyle: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-text)",
};

export const tooltipLabelStyle: CSSProperties = {
  color: "var(--color-text)",
  fontWeight: 600,
  marginBottom: 4,
};

export const tooltipItemStyle: CSSProperties = {
  color: "var(--color-success)",
  fontWeight: 600,
};

/** Spread onto every <Tooltip>. Bar charts also pass cursor={false} — the bar's own
 *  hover pop (see .recharts-bar-rectangle in index.css) is the hover feedback instead
 *  of Recharts' default full-height cursor rectangle. */
export const chartTooltipProps = {
  contentStyle: tooltipContentStyle,
  labelStyle: tooltipLabelStyle,
  itemStyle: tooltipItemStyle,
};
