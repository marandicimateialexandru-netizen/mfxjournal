import { useState } from "react";
import { Check, Download, Upload, Trash2, KeyRound, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSettings, useUpdateSettings } from "@/features/settings/useSettings";
import { useTrades, useTradeMutations } from "@/features/trades/useTrades";
import { useVariables } from "@/features/variables/useVariables";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { THEME_PRESETS } from "@/features/theming/presets";
import { applyTheme } from "@/features/theming/applyTheme";
import { testApiKey } from "@/features/ai/aiClient";
import { testGroqKey } from "@/features/ai/groqClient";
import { countTestTrades, deleteTestTrades } from "@/db/seed";
import type { CustomColors, CalcMode } from "@/db/types";
import { useQueryClient } from "@tanstack/react-query";

function tradesToCsv(trades: ReturnType<typeof useTrades>["data"], variables: ReturnType<typeof useVariables>["data"]): string {
  const varCols = (variables ?? []).map((v) => v.label);
  const header = ["Date", "Market", "Outcome", "Risk R", "Result R", "Notes", ...varCols];
  const rows = (trades ?? []).map((t) => {
    const varVals = (variables ?? []).map((v) => {
      const tagged = t.variableValues?.[v.id];
      if (v.type === "number") return tagged?.numberValue ?? "";
      const val = v.values.find((x) => x.id === tagged?.valueId);
      return val?.label ?? "";
    });
    return [
      t.entry_time,
      t.market ?? "",
      t.outcome,
      t.risk_r ?? "",
      t.result_r,
      (t.notes ?? "").replace(/"/g, '""'),
      ...varVals,
    ];
  });
  const escape = (v: unknown) => `"${String(v)}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export default function SettingsPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: trades } = useTrades();
  const { data: variables } = useVariables();
  const { deleteAllTrades } = useTradeMutations();
  const queryClient = useQueryClient();

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [groqKeyDraft, setGroqKeyDraft] = useState("");
  const [groqTestResult, setGroqTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [groqTesting, setGroqTesting] = useState(false);
  const [seedCount, setSeedCount] = useState<number | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [customColors, setCustomColors] = useState<CustomColors | null>(
    settings?.custom_colors ? JSON.parse(settings.custom_colors) : null,
  );

  if (!settings) return null;

  async function selectPreset(id: string) {
    await updateSettings.mutateAsync({ theme: id });
    applyTheme(id, null);
  }

  async function saveCustomColors(colors: CustomColors) {
    setCustomColors(colors);
    await updateSettings.mutateAsync({ theme: "custom", custom_colors: JSON.stringify(colors) });
    applyTheme("custom", colors);
  }

  async function handleTestConnection() {
    setTesting(true);
    const result = await testApiKey(apiKeyDraft || settings!.ai_api_key || "");
    setTestResult(result);
    setTesting(false);
  }

  async function handleTestGroqConnection() {
    setGroqTesting(true);
    const result = await testGroqKey(groqKeyDraft || settings!.groq_api_key || "", settings!.groq_model);
    setGroqTestResult(result);
    setGroqTesting(false);
  }

  async function handleExport() {
    const csv = tradesToCsv(trades, variables);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mfxjournal-trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshSeedCount() {
    if (!workspaceId) return;
    setSeedCount(await countTestTrades(workspaceId));
  }

  const baseColors: CustomColors =
    customColors ?? THEME_PRESETS.find((p) => p.id === settings.theme)?.colors ?? THEME_PRESETS[0].colors;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Appearance, display mode, AI, and data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="relative h-12 w-full rounded-md border border-[var(--color-border)]"
                  style={{ background: preset.colors.background }}
                >
                  <div className="absolute inset-1 rounded" style={{ background: preset.colors.surface }} />
                  <div className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full" style={{ background: preset.colors.primary }} />
                  {settings.theme === preset.id && (
                    <Check className="absolute right-1 top-1 h-3 w-3 text-white" />
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{preset.name}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-md border border-[var(--color-border)] p-3">
            <p className="text-sm font-medium">Custom Colors</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["primary", "Primary"],
                  ["background", "Background"],
                  ["surface", "Surface"],
                  ["text", "Text"],
                ] as [keyof CustomColors, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={baseColors[key]}
                      onChange={(e) => saveCustomColors({ ...baseColors, [key]: e.target.value })}
                      className="h-8 w-8 rounded border border-[var(--color-border)] bg-transparent"
                    />
                    <Input
                      value={baseColors[key]}
                      onChange={(e) => saveCustomColors({ ...baseColors, [key]: e.target.value })}
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => selectPreset("midnight")}>
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Calculation Mode</Label>
            <Select value={settings.calc_mode} onValueChange={(v) => updateSettings.mutate({ calc_mode: v as CalcMode })}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="r">R Multiple</SelectItem>
                <SelectItem value="percent">Percent (%)</SelectItem>
                <SelectItem value="dollar">Dollar ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Risk per R (%)</Label>
              <Input
                type="number"
                step="0.1"
                defaultValue={settings.risk_per_r_percent ?? 1}
                onBlur={(e) => updateSettings.mutate({ risk_per_r_percent: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Risk per R ($)</Label>
              <Input
                type="number"
                step="1"
                defaultValue={settings.risk_per_r_dollar ?? 100}
                onBlur={(e) => updateSettings.mutate({ risk_per_r_dollar: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Day Win % breakeven range</Label>
            <Input
              type="number"
              step="0.1"
              defaultValue={settings.day_win_be_range ?? 0}
              onBlur={(e) => updateSettings.mutate({ day_win_be_range: Number(e.target.value) })}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Assistants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["ai_task_assistant_enabled", "AI Task Assistant"],
              ["mindset_coach_enabled", "Mindset Coach"],
              ["voice_input_enabled", "Voice Trade Input"],
            ] as [keyof typeof settings, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch
                checked={(settings[key] as number) !== 0}
                onCheckedChange={(checked) => updateSettings.mutate({ [key]: checked ? 1 : 0 } as any)}
              />
            </div>
          ))}
          <div className="space-y-1.5 border-t border-[var(--color-border)] pt-3">
            <Label className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> Anthropic API Key
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={settings.ai_api_key ? "••••••••••••••••" : "sk-ant-…"}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  await updateSettings.mutateAsync({ ai_api_key: apiKeyDraft || settings.ai_api_key });
                }}
              >
                Save
              </Button>
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? "Testing…" : "Test Connection"}
              </Button>
            </div>
            {testResult && (
              <p className={`text-xs ${testResult.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {testResult.message}
              </p>
            )}
            <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Info className="h-3 w-3" /> Stored locally only, never sent anywhere but Anthropic's API.
            </p>
          </div>

          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <Label>MFX AI Assistant Engine</Label>
            <p className="text-xs text-[var(--color-text-muted)]">
              Only affects the chat on the AI Advisor page — Task Assistant, Mindset Coach, and Voice Input above always use the
              Anthropic key.
            </p>
            <div className="flex gap-2">
              <Button
                variant={settings.ai_provider === "claude" ? "default" : "outline"}
                size="sm"
                onClick={() => updateSettings.mutate({ ai_provider: "claude" })}
              >
                Claude (paid, best quality)
              </Button>
              <Button
                variant={settings.ai_provider === "groq" ? "default" : "outline"}
                size="sm"
                onClick={() => updateSettings.mutate({ ai_provider: "groq" })}
              >
                Groq (free, cloud)
              </Button>
              <Button
                variant={settings.ai_provider === "ollama" ? "default" : "outline"}
                size="sm"
                onClick={() => updateSettings.mutate({ ai_provider: "ollama" })}
              >
                Local / Free (Ollama)
              </Button>
            </div>
            {settings.ai_provider === "groq" && (
              <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Free, no credit card, no local install — just a one-time signup:
                </p>
                <ol className="list-inside list-decimal space-y-0.5 text-xs text-[var(--color-text-muted)]">
                  <li>
                    Go to <span className="text-[var(--color-text)]">console.groq.com</span> and sign up (Google/GitHub login works).
                  </li>
                  <li>Open "API Keys" in the left sidebar and click "Create API Key."</li>
                  <li>Copy the key (starts with "gsk_") and paste it below.</li>
                </ol>
                <div className="flex gap-2 pt-1">
                  <Input
                    type="password"
                    placeholder={settings.groq_api_key ? "••••••••••••••••" : "gsk_…"}
                    value={groqKeyDraft}
                    onChange={(e) => setGroqKeyDraft(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await updateSettings.mutateAsync({ groq_api_key: groqKeyDraft || settings.groq_api_key });
                    }}
                  >
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleTestGroqConnection} disabled={groqTesting}>
                    {groqTesting ? "Testing…" : "Test Connection"}
                  </Button>
                </div>
                {groqTestResult && (
                  <p className={`text-xs ${groqTestResult.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {groqTestResult.message}
                  </p>
                )}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs">Model name</Label>
                  <Input
                    defaultValue={settings.groq_model}
                    onBlur={(e) => updateSettings.mutate({ groq_model: e.target.value || "openai/gpt-oss-120b" })}
                    placeholder="openai/gpt-oss-120b"
                  />
                </div>
                <p className="flex items-start gap-1 text-xs text-[var(--color-text-muted)]">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" /> If a model stops working, Groq occasionally retires old ones — check
                  "Models" in your Groq console for the current name and update it above.
                </p>
              </div>
            )}
            {settings.ai_provider === "ollama" && (
              <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Model name</Label>
                    <Input
                      defaultValue={settings.ollama_model}
                      onBlur={(e) => updateSettings.mutate({ ollama_model: e.target.value || "llama3.1" })}
                      placeholder="llama3.1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ollama URL</Label>
                    <Input
                      defaultValue={settings.ollama_base_url}
                      onBlur={(e) => updateSettings.mutate({ ollama_base_url: e.target.value || "http://localhost:11434" })}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                </div>
                <p className="flex items-start gap-1 text-xs text-[var(--color-text-muted)]">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" /> Free and fully offline, but runs on your own machine's hardware —
                  install Ollama from ollama.com, then run <code className="rounded bg-[var(--color-background)] px-1">ollama pull{" "}
                  {settings.ollama_model || "llama3.1"}</code>. Quality won't match Claude, especially for nuanced pattern analysis.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export Trades (CSV)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Upload className="h-4 w-4" /> Import from CSV
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refreshSeedCount}>
              Check sample data
            </Button>
            {seedCount !== null && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {seedCount} sample trade{seedCount === 1 ? "" : "s"} found
              </span>
            )}
            {seedCount !== null && seedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!workspaceId) return;
                  await deleteTestTrades(workspaceId);
                  queryClient.invalidateQueries({ queryKey: ["trades", workspaceId] });
                  setSeedCount(0);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete Test Trades
              </Button>
            )}
          </div>

          <div className="space-y-1.5 border-t border-[var(--color-border)] pt-3">
            <Label className="text-[var(--color-danger)]">Danger Zone</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={!trades || trades.length === 0}
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete All Trades
              </Button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Permanently removes every trade ({trades?.length ?? 0}) from "{workspaceName}".
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About & Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-[var(--color-text-muted)]">
          <p>MFXJournal v0.1.0</p>
          <p>Know your stake, reduce the mistake, increase your winrate.</p>
        </CardContent>
      </Card>

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Trades?</DialogTitle>
            <DialogDescription>
              This will permanently delete all {trades?.length ?? 0} trade{trades?.length === 1 ? "" : "s"} in this
              workspace, along with their tagged variables and screenshots. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAllTrades.isPending}
              onClick={async () => {
                await deleteAllTrades.mutateAsync();
                setDeleteAllOpen(false);
              }}
            >
              Delete All Trades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
