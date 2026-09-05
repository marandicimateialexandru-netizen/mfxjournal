import { select, execute } from "../client";
import type { Settings } from "../types";

const DEFAULTS: Omit<Settings, "workspace_id"> = {
  theme: "midnight",
  custom_colors: null,
  calc_mode: "r",
  risk_per_r_percent: 1,
  risk_per_r_dollar: 100,
  day_win_be_range: 0,
  ai_api_key: null,
  ai_task_assistant_enabled: 1,
  mindset_coach_enabled: 1,
  voice_input_enabled: 1,
};

export async function getSettings(workspaceId: string): Promise<Settings> {
  const rows = await select<Settings>("SELECT * FROM settings WHERE workspace_id = ?", [
    workspaceId,
  ]);
  if (rows.length > 0) return rows[0];
  const settings: Settings = { workspace_id: workspaceId, ...DEFAULTS };
  await execute(
    `INSERT INTO settings (workspace_id, theme, custom_colors, calc_mode, risk_per_r_percent, risk_per_r_dollar, day_win_be_range, ai_api_key, ai_task_assistant_enabled, mindset_coach_enabled, voice_input_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settings.workspace_id,
      settings.theme,
      settings.custom_colors,
      settings.calc_mode,
      settings.risk_per_r_percent,
      settings.risk_per_r_dollar,
      settings.day_win_be_range,
      settings.ai_api_key,
      settings.ai_task_assistant_enabled,
      settings.mindset_coach_enabled,
      settings.voice_input_enabled,
    ],
  );
  return settings;
}

export async function updateSettings(
  workspaceId: string,
  patch: Partial<Omit<Settings, "workspace_id">>,
): Promise<void> {
  const current = await getSettings(workspaceId);
  const merged = { ...current, ...patch };
  await execute(
    `UPDATE settings SET theme = ?, custom_colors = ?, calc_mode = ?, risk_per_r_percent = ?, risk_per_r_dollar = ?, day_win_be_range = ?, ai_api_key = ?, ai_task_assistant_enabled = ?, mindset_coach_enabled = ?, voice_input_enabled = ?
     WHERE workspace_id = ?`,
    [
      merged.theme,
      merged.custom_colors,
      merged.calc_mode,
      merged.risk_per_r_percent,
      merged.risk_per_r_dollar,
      merged.day_win_be_range,
      merged.ai_api_key,
      merged.ai_task_assistant_enabled,
      merged.mindset_coach_enabled,
      merged.voice_input_enabled,
      workspaceId,
    ],
  );
}
