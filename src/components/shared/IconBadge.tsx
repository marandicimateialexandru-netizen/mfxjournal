import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type IconTone = "violet" | "green" | "red" | "amber" | "teal" | "blue" | "rose" | "slate";

/** Anything renderable as a colored glyph inside an IconBadge — a lucide icon or a hand-drawn custom SVG icon. */
export type IconComponent = ComponentType<{
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}>;

export const TONE_GRADIENTS: Record<IconTone, string> = {
  violet: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  green: "linear-gradient(135deg, #34d399, #059669)",
  red: "linear-gradient(135deg, #f87171, #dc2626)",
  amber: "linear-gradient(135deg, #fbbf24, #d97706)",
  teal: "linear-gradient(135deg, #2dd4bf, #0891b2)",
  blue: "linear-gradient(135deg, #60a5fa, #2563eb)",
  rose: "linear-gradient(135deg, #fb7185, #e11d48)",
  slate: "linear-gradient(135deg, #94a3b8, #475569)",
};

/** Single flat accent hex per tone (the lighter of each gradient's two stops) — for glows,
 *  accent text, and anything else that wants one representative color rather than a gradient. */
export const TONE_ACCENT: Record<IconTone, string> = {
  violet: "#8b5cf6",
  green: "#34d399",
  red: "#f87171",
  amber: "#fbbf24",
  teal: "#2dd4bf",
  blue: "#60a5fa",
  rose: "#fb7185",
  slate: "#94a3b8",
};

export function IconBadge({
  icon: Icon,
  emoji,
  tone = "violet",
  size = 34,
  className,
}: {
  icon?: IconComponent;
  emoji?: string;
  tone?: IconTone;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-[10px] shadow-sm", className)}
      style={{ width: size, height: size, background: TONE_GRADIENTS[tone] }}
    >
      {Icon && <Icon className="text-white" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.25} />}
      {emoji && <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{emoji}</span>}
    </div>
  );
}

const TONE_ORDER: IconTone[] = ["violet", "teal", "amber", "blue", "rose", "green"];

/** Deterministically assigns a badge tone from an id/key so the same variable always gets the same color. */
export function toneForKey(key: string): IconTone {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TONE_ORDER[hash % TONE_ORDER.length];
}
