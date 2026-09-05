import { useState } from "react";
import { Send, Mic, Image as ImageIcon, History, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { askTradingAnalyst, QUICK_PROMPTS } from "@/features/ai/tradingAnalystChat";
import { AiNotConfiguredError, type AiMessage } from "@/features/ai/aiClient";
import type { StatsResult } from "@/features/stats/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function AdvisorChat({ apiKey, stats }: { apiKey: string | null | undefined; stats: StatsResult }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"quick" | "detailed">("quick");
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const history: AiMessage[] = messages.map((m) => ({ role: m.role, content: m.text }));
      const answer = await askTradingAnalyst(apiKey, question, stats, mode, history);
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      const text = err instanceof AiNotConfiguredError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[520px] flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
        <div>
          <div className="text-sm font-medium">Trading Analyst</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            AI-Powered — analyze your performance with rigorous statistical precision. Data over feelings.
          </div>
        </div>
        <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <History className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 text-left text-xs hover:border-[var(--color-primary)]"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm",
              m.role === "user" ? "ml-auto bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-background)]",
            )}
          >
            {m.text}
          </div>
        ))}
        {busy && <p className="text-xs text-[var(--color-text-muted)]">Analyzing…</p>}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-[var(--color-border)] p-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
        <button
          onClick={() => setMode("quick")}
          title="Quick mode"
          className={cn("text-[var(--color-text-muted)]", mode === "quick" && "text-[var(--color-primary)]")}
        >
          <Zap className="h-4 w-4" />
        </button>
        <button
          onClick={() => setMode("detailed")}
          title="Detailed mode"
          className={cn("text-[var(--color-text-muted)]", mode === "detailed" && "text-[var(--color-primary)]")}
        >
          <Info className="h-4 w-4" />
        </button>
        <button className="text-[var(--color-text-muted)]">
          <ImageIcon className="h-4 w-4" />
        </button>
        <button className="text-[var(--color-text-muted)]">
          <Mic className="h-4 w-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your trading data…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
        />
        <Button size="icon" variant="ghost" onClick={() => send(input)} disabled={busy}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
