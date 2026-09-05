import type { CustomColors } from "@/db/types";
import { getPreset } from "./presets";

const TOKEN_MAP: Record<keyof CustomColors, string> = {
  primary: "--color-primary",
  primaryForeground: "--color-primary-foreground",
  background: "--color-background",
  surface: "--color-surface",
  surfaceForeground: "--color-surface-foreground",
  text: "--color-text",
  textMuted: "--color-text-muted",
  success: "--color-success",
  danger: "--color-danger",
  warning: "--color-warning",
  border: "--color-border",
};

export function applyColors(colors: CustomColors): void {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TOKEN_MAP) as [keyof CustomColors, string][]) {
    root.style.setProperty(cssVar, colors[key]);
  }
}

export function applyTheme(themeId: string, customColors: CustomColors | null): void {
  if (themeId === "custom" && customColors) {
    applyColors(customColors);
    return;
  }
  applyColors(getPreset(themeId).colors);
}
