import { useState } from "react";
import { X, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadialGauge } from "@/components/shared/RadialGauge";
import { useTrades } from "@/features/trades/useTrades";
import { usePlanningEntries } from "./usePlanning";
import { useSettings } from "@/features/settings/useSettings";
import { runMindsetCoach, type MindsetCoachResult } from "./mindsetCoach";
import { AiNotConfiguredError } from "@/features/ai/aiClient";

export function MindsetCoachPanel({ onClose }: { onClose: () => void }) {
  const { data: trades = [] } = useTrades();
  const { data: entries = [] } = usePlanningEntries();
  const { data: settings } = useSettings();
  const [result, setResult] = useState<MindsetCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await runMindsetCoach(settings?.ai_api_key, trades, entries);
      setResult(data);
    } catch (err) {
      setError(err instanceof AiNotConfiguredError ? err.message : err instanceof Error ? err.message : "Failed to run.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 top-6 z-40 flex w-[380px] flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="text-sm font-medium">Mindset Coach</span>
        </div>
        <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
          <button onClick={run} className="hover:text-[var(--color-text)]" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="hover:text-[var(--color-text)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!result && !loading && !error && (
          <div className="text-center">
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">
              Analyze your recent trades and journal entries for behavioral patterns.
            </p>
            <Button onClick={run}>Run Mindset Coach</Button>
          </div>
        )}
        {loading && <p className="text-sm text-[var(--color-text-muted)]">Analyzing…</p>}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        {result && (
          <>
            <div className="flex flex-col items-center gap-2">
              <RadialGauge value={result.score} size={90} strokeWidth={8} label="Mindset" />
              <p className="text-center text-sm text-[var(--color-text-muted)]">{result.summary}</p>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Key Insights</h3>
              <ul className="space-y-1 text-sm">
                {result.insights.map((i, idx) => (
                  <li key={idx}>• {i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Behavioral Patterns</h3>
              <div className="space-y-2">
                {result.patterns.map((p, idx) => (
                  <div
                    key={idx}
                    className={`rounded-md border p-2 text-sm ${p.tone === "positive" ? "border-[var(--color-success)]/40" : "border-[var(--color-danger)]/40"}`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">This Week's Focus</h3>
              <p className="text-sm">{result.focus}</p>
            </div>
            {result.watchOuts.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Watch Out</h3>
                <ul className="space-y-1 text-sm text-[var(--color-warning)]">
                  {result.watchOuts.map((w, idx) => (
                    <li key={idx}>⚠ {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
