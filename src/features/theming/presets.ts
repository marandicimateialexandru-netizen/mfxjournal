import type { CustomColors } from "@/db/types";

export interface ThemePreset {
  id: string;
  name: string;
  colors: CustomColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      primary: "#241a3d",
      primaryForeground: "#f5f3ff",
      background: "#0d0a16",
      surface: "#161228",
      surfaceForeground: "#e8e5f5",
      text: "#e8e5f5",
      textMuted: "#8e86ad",
      success: "#34d399",
      danger: "#ef4444",
      warning: "#facc15",
      border: "#241f3a",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      primary: "#0e4f6b",
      primaryForeground: "#f0f9ff",
      background: "#081824",
      surface: "#0f2634",
      surfaceForeground: "#dceef7",
      text: "#dceef7",
      textMuted: "#7ea3b5",
      success: "#22c55e",
      danger: "#f87171",
      warning: "#facc15",
      border: "#1c3a4a",
    },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      primary: "#1f4d3a",
      primaryForeground: "#f0fdf4",
      background: "#0c1a13",
      surface: "#132a1e",
      surfaceForeground: "#dcf3e5",
      text: "#dcf3e5",
      textMuted: "#7fa88f",
      success: "#4ade80",
      danger: "#f87171",
      warning: "#facc15",
      border: "#1e3b2b",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      primary: "#5a2a1e",
      primaryForeground: "#fff7ed",
      background: "#1a0f0c",
      surface: "#271713",
      surfaceForeground: "#f5e3da",
      text: "#f5e3da",
      textMuted: "#ab8577",
      success: "#4ade80",
      danger: "#f87171",
      warning: "#facc15",
      border: "#3a2219",
    },
  },
  {
    id: "violet",
    name: "Violet",
    colors: {
      primary: "#3b2d5c",
      primaryForeground: "#f5f3ff",
      background: "#120e1e",
      surface: "#1c1730",
      surfaceForeground: "#e6e1f7",
      text: "#e6e1f7",
      textMuted: "#8c81ab",
      success: "#4ade80",
      danger: "#f87171",
      warning: "#facc15",
      border: "#2b2347",
    },
  },
  {
    id: "slate",
    name: "Slate",
    colors: {
      primary: "#334155",
      primaryForeground: "#f8fafc",
      background: "#0b0f16",
      surface: "#161b26",
      surfaceForeground: "#e2e8f0",
      text: "#e2e8f0",
      textMuted: "#8493a8",
      success: "#22c55e",
      danger: "#ef4444",
      warning: "#facc15",
      border: "#242c3a",
    },
  },
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
