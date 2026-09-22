-- MFXJournal SQLite schema

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','number')),
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variable_values (
  id TEXT PRIMARY KEY,
  variable_id TEXT NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custom_results (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  label TEXT NOT NULL,
  maps_to TEXT NOT NULL CHECK (maps_to IN ('win','loss','be')),
  icon TEXT
);

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  symbol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  strategy_id TEXT REFERENCES strategies(id),
  account_id TEXT REFERENCES accounts(id),
  entry_time TEXT NOT NULL,
  end_time TEXT,
  outcome TEXT NOT NULL,
  risk_r REAL,
  result_r REAL NOT NULL,
  market TEXT,
  notes TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_variable_values (
  trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  variable_id TEXT NOT NULL REFERENCES variables(id),
  value_id TEXT REFERENCES variable_values(id),
  number_value REAL,
  PRIMARY KEY (trade_id, variable_id)
);

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT
);

CREATE TABLE IF NOT EXISTS planning_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly','yearly')),
  date_start TEXT NOT NULL,
  date_end TEXT,
  title TEXT,
  mood INTEGER,
  energy INTEGER,
  confidence INTEGER,
  journal_text TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planning_entry_trades (
  entry_id TEXT NOT NULL REFERENCES planning_entries(id) ON DELETE CASCADE,
  trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, trade_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly','yearly')),
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS streak_thresholds (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  threshold INTEGER NOT NULL,
  be_breaks_streak INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  theme TEXT NOT NULL DEFAULT 'dark',
  custom_colors TEXT,
  calc_mode TEXT NOT NULL DEFAULT 'r',
  risk_per_r_percent REAL,
  risk_per_r_dollar REAL,
  day_win_be_range REAL,
  ai_api_key TEXT,
  ai_task_assistant_enabled INTEGER NOT NULL DEFAULT 1,
  mindset_coach_enabled INTEGER NOT NULL DEFAULT 1,
  voice_input_enabled INTEGER NOT NULL DEFAULT 1,
  accounts_enabled INTEGER NOT NULL DEFAULT 0,
  streak_analysis_enabled INTEGER NOT NULL DEFAULT 0,
  streak_be_breaks_streak INTEGER NOT NULL DEFAULT 1,
  variables_card_order TEXT
);

CREATE TABLE IF NOT EXISTS variable_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- extra tables not in the original spec's SQL block but required by pages described in prose:

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL, -- JSON: { tiles: [...], sections: {visible/order...} }
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_combinations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  filters TEXT NOT NULL, -- JSON: [{variableId, include, valueIds}]
  display_settings TEXT, -- JSON: {showWinRate, showBeRate, showTotal}
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_tester_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  action TEXT NOT NULL CHECK (action IN ('only_trade','do_not_trade','reduce_risk')),
  variable_id TEXT REFERENCES variables(id),
  value_ids TEXT, -- JSON array
  combination TEXT, -- JSON: optional {variableId, valueIds}
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prop_firm_rows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  account_name TEXT NOT NULL,
  capital REAL NOT NULL,
  profit_split_pct REAL NOT NULL DEFAULT 80,
  monthly_pct_override REAL,
  payout_frequency TEXT NOT NULL DEFAULT 'monthly',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_state (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  tour_completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trades_workspace ON trades(workspace_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_tvv_trade ON trade_variable_values(trade_id);
CREATE INDEX IF NOT EXISTS idx_tvv_variable ON trade_variable_values(variable_id);
CREATE INDEX IF NOT EXISTS idx_planning_workspace ON planning_entries(workspace_id, period, date_start);
