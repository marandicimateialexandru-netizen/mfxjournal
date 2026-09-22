export type Period = "daily" | "weekly" | "monthly" | "yearly";
export type Outcome = "win" | "loss" | "be" | string; // string = custom_result id
export type VariableType = "text" | "number";
export type CalcMode = "r" | "percent" | "dollar";

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface Strategy {
  id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

export interface Account {
  id: string;
  workspace_id: string;
  name: string;
}

export interface Variable {
  id: string;
  workspace_id: string;
  key: string;
  label: string;
  type: VariableType;
  icon: string | null;
  sort_order: number;
}

export interface VariableValue {
  id: string;
  variable_id: string;
  label: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface CustomResult {
  id: string;
  workspace_id: string;
  label: string;
  maps_to: "win" | "loss" | "be";
  icon: string | null;
}

export interface VariableTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  data: string; // JSON-serialized TemplateData
  created_at: string;
}

export interface TemplateVariableValue {
  label: string;
  icon: string | null;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: VariableType;
  icon: string | null;
  values: TemplateVariableValue[];
}

export interface TemplateData {
  variables: TemplateVariable[];
}

export interface Market {
  id: string;
  workspace_id: string;
  symbol: string;
}

export interface Trade {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  account_id: string | null;
  entry_time: string;
  end_time: string | null;
  outcome: Outcome;
  risk_r: number | null;
  result_r: number;
  market: string | null;
  notes: string | null;
  is_seed: number;
  created_at: string;
  updated_at: string;
  // hydrated, not raw columns:
  variableValues?: Record<string, { valueId?: string; numberValue?: number }>;
  screenshots?: TradeScreenshot[];
}

export interface TradeVariableValue {
  trade_id: string;
  variable_id: string;
  value_id: string | null;
  number_value: number | null;
}

export interface TradeScreenshot {
  id: string;
  trade_id: string;
  file_path: string;
  sort_order: number;
  label: string | null;
}

export interface PlanningEntry {
  id: string;
  workspace_id: string;
  period: Period;
  date_start: string;
  date_end: string | null;
  title: string | null;
  mood: number | null;
  energy: number | null;
  confidence: number | null;
  journal_text: string | null;
  created_at: string;
  linkedTradeIds?: string[];
}

export interface Task {
  id: string;
  workspace_id: string;
  period: Period;
  date: string;
  label: string;
  done: number;
}

export interface StreakThreshold {
  id: string;
  workspace_id: string;
  threshold: number;
  be_breaks_streak: number;
}

export interface CustomCombination {
  id: string;
  workspace_id: string;
  name: string;
  filters: string; // JSON-serialized CombinationFilter[]: {variableId, include, valueIds}[]
  display_settings: string | null; // JSON-serialized {showWinRate, showBeRate, showTotal}
  created_at: string;
}

export interface CustomColors {
  primary: string;
  primaryForeground: string;
  background: string;
  surface: string;
  surfaceForeground: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
}

export interface Settings {
  workspace_id: string;
  theme: string;
  custom_colors: string | null; // JSON blob
  calc_mode: CalcMode;
  risk_per_r_percent: number | null;
  risk_per_r_dollar: number | null;
  day_win_be_range: number | null;
  ai_api_key: string | null;
  ai_task_assistant_enabled: number;
  mindset_coach_enabled: number;
  voice_input_enabled: number;
  accounts_enabled: number;
  streak_analysis_enabled: number;
  streak_be_breaks_streak: number;
  variables_card_order: string | null; // JSON-serialized string[] of card keys
}
