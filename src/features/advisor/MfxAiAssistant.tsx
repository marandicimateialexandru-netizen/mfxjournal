import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Send, RotateCcw, User, Sparkles, ArrowUpRight, Power } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AiAssistantLogoMark } from "@/components/shared/AiAssistantLogo";
import { AiNotConfiguredError, type AiMessage } from "@/features/ai/aiClient";
import { OllamaNotReachableError } from "@/features/ai/localAiClient";
import { GroqNotConfiguredError } from "@/features/ai/groqClient";
import { askMfxAssistant, pickStarterQuestion, pickStarterAlternatives, type AssistantProviderConfig } from "@/features/ai/mfxAssistant";
import { buildAssistantSystemPrompt } from "@/features/ai/mfxAssistantContext";
import { useMarkets, useStreakThresholds } from "@/features/variables/useAuxLists";
import type { StatsResult } from "@/features/stats/types";
import type { Trade, CustomResult, Settings } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
}

interface MfxAiAssistantProps {
  stats: StatsResult;
  trades: Trade[];
  variables: VariableWithValues[];
  customResults: CustomResult[];
  settings: Settings | undefined;
}

/** Renders the assistant's markdown (bold, headers, bullet/numbered lists) with the app's own
 *  Tailwind classes instead of the browser's unstyled defaults — this is what turns "**Win rate:**"
 *  showing up as literal asterisks into an actually-typeset answer. Only used for assistant replies;
 *  the trader's own typed messages render as plain text. */
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[#c4b5fd]">{children}</strong>,
        em: ({ children }) => <em className="text-[var(--color-text-muted)]">{children}</em>,
        h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-xs font-bold uppercase tracking-wide text-[#a78bfa] first:mt-0">{children}</h3>,
        h2: ({ children }) => <h3 className="mb-1.5 mt-3 text-xs font-bold uppercase tracking-wide text-[#a78bfa] first:mt-0">{children}</h3>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-xs font-bold uppercase tracking-wide text-[#a78bfa] first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-[#8b5cf6]">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:text-[#8b5cf6]">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
        code: ({ children }) => <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.8em]">{children}</code>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-[#8b5cf6] underline">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}

/** Reveals `text` progressively over `durationMs` via rAF, giving assistant replies a "being typed
 *  out live" feel instead of slamming the whole answer onto screen at once — this only ever runs for
 *  the single most-recent assistant message (`active`); every older bubble just gets its full text
 *  immediately, so re-renders (scrolling, hovering a chip) never replay the animation. */
function useTypewriter(text: string, active: boolean, durationMs = 700): string {
  const [revealed, setRevealed] = useState(active ? "" : text);
  useEffect(() => {
    if (!active) {
      setRevealed(text);
      return;
    }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const pct = Math.min(1, (now - start) / durationMs);
      setRevealed(text.slice(0, Math.round(text.length * pct)));
      if (pct < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);
  return revealed;
}

function ChatBubble({ message, animate }: { message: ChatMessage; animate: boolean }) {
  const revealed = useTypewriter(message.text, animate && message.role === "assistant");
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6]/15 text-[#8b5cf6] ring-1 ring-[#8b5cf6]/25">
          <User className="h-3.5 w-3.5" />
        </div>
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[#8b5cf6]/25">
          <AiAssistantLogoMark size={28} />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "animate-bubble-in-right" : "animate-bubble-in-left",
          isUser
            ? "rounded-br-sm bg-gradient-to-br from-[#9d6ffb] to-[#7c3aed] text-white shadow-[0_4px_16px_-6px_rgba(139,92,246,0.6)]"
            : "rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] shadow-[0_4px_16px_-8px_rgba(0,0,0,0.5)]",
        )}
      >
        {isUser ? <span className="whitespace-pre-wrap">{message.text}</span> : <AssistantMarkdown text={revealed} />}
      </div>
    </div>
  );
}

/** The MFX AI Assistant — a full trading-coach chat, not a stats lookup box. The system prompt (built
 *  fresh from the live stats engine in `mfxAssistantContext.ts`) gives it everything: every core
 *  metric, day/hour/month/market/variable/streak breakdowns, detected patterns, and a recent-trade
 *  ledger with notes, so it can answer specifics, not just averages. It always proposes 2 follow-up
 *  questions (see the "---SUGGESTIONS---" contract in `mfxAssistant.ts`) so the conversation has
 *  somewhere to go even when the trader doesn't know what to ask next. Runs on Anthropic's paid API,
 *  a free local Ollama model, or Groq's free cloud API, per `settings.ai_provider` (Settings page). */
export function MfxAiAssistant({ stats, trades, variables, customResults, settings }: MfxAiAssistantProps) {
  const { data: markets = [] } = useMarkets();
  const { data: streakThresholds = [] } = useStreakThresholds();

  const isGroq = settings?.ai_provider === "groq";
  const systemPrompt = useMemo(
    () => buildAssistantSystemPrompt({ stats, trades, variables, customResults, markets, streakThresholds, settings, compact: isGroq }),
    [stats, trades, variables, customResults, markets, streakThresholds, settings, isGroq],
  );

  const providerConfig: AssistantProviderConfig = useMemo(
    () => ({
      provider: settings?.ai_provider ?? "claude",
      apiKey: settings?.ai_api_key,
      ollamaModel: settings?.ollama_model ?? "llama3.1",
      ollamaBaseUrl: settings?.ollama_base_url ?? "http://localhost:11434",
      groqApiKey: settings?.groq_api_key,
      groqModel: settings?.groq_model ?? "openai/gpt-oss-120b",
    }),
    [settings],
  );

  // Gates the whole chat behind an explicit "boot up" step — resets every time this page mounts, so
  // the cool power-on animation is something the trader actually triggers by clicking Start rather
  // than something that just plays passively (and gets missed) the instant the page loads.
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [starterQuestion, setStarterQuestion] = useState(() => pickStarterQuestion(stats));
  const [starterAlternatives, setStarterAlternatives] = useState(() => pickStarterAlternatives(stats, starterQuestion));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // The starter question lives only as a placeholder — never as real input text — so it never has
  // to be deleted before typing a real question; it just fades away the moment you start typing,
  // and hitting Enter on an empty box sends it as-is.
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function resetConversation() {
    const next = pickStarterQuestion(stats);
    setMessages([]);
    setStarterQuestion(next);
    setStarterAlternatives(pickStarterAlternatives(stats, next));
    setInput("");
  }

  /** `explicitQuestion` (chip clicks) always wins. Otherwise this reads the real input box, and —
   *  only when that's empty and no message has been sent yet — falls back to whatever starter
   *  question is currently just a placeholder, so Enter-on-empty behaves exactly like the ghost text
   *  was real. */
  async function send(explicitQuestion?: string) {
    const raw = explicitQuestion ?? input;
    const trimmed = raw.trim();
    const usingGhost = explicitQuestion === undefined && !trimmed && messages.length === 0;
    const effective = usingGhost ? starterQuestion : trimmed;
    if (!effective) return;

    const history: AiMessage[] = messages.map((m) => ({ role: m.role, content: m.text }));

    setMessages((prev) => [...prev, { role: "user", text: effective }]);
    setInput("");
    setBusy(true);
    scrollToBottom();

    try {
      const reply = await askMfxAssistant(providerConfig, systemPrompt, history, effective, {
        trades: stats.filteredTrades,
        variables,
        customResults,
      });
      setMessages((prev) => [...prev, { role: "assistant", text: reply.text, suggestions: reply.suggestions }]);
    } catch (err) {
      const text =
        err instanceof AiNotConfiguredError || err instanceof OllamaNotReachableError || err instanceof GroqNotConfiguredError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  const lastMessage = messages[messages.length - 1];
  const activeSuggestions = !busy && lastMessage?.role === "assistant" ? (lastMessage.suggestions ?? []).slice(0, 2) : [];

  /** A three-beat exit instead of one uniform fade: the copy leaves first (quick fade-up, 0-220ms),
   *  then the dot-grid backdrop "iris closes" toward the logo's position while the logo itself
   *  shrinks into that same point (160-580ms) — a camera-shutter-closing effect via `clip-path`
   *  rather than a plain opacity fade. `setStarted` fires right as that finishes, and a brief light
   *  flash on the chat's mount papers over the exact DOM-swap frame. */
  function handleStart() {
    setStarting(true);
    setTimeout(() => setStarted(true), 580);
  }

  if (!started) {
    return (
      <Card className="relative flex h-[680px] flex-col items-center justify-center gap-5 overflow-hidden">
        <div
          className={cn("pointer-events-none absolute inset-0 opacity-70", starting && "animate-iris-close")}
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 42%, rgba(139,92,246,0.18), transparent 62%), radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 26px 26px",
          }}
        />
        <div className={cn("relative flex items-center justify-center", starting && "animate-boot-logo-exit")}>
          <span className="animate-logo-idle-pulse absolute inset-0 rounded-full border-2 border-[#8b5cf6]" />
          <AiAssistantLogoMark size={88} />
        </div>
        <div className={cn("relative space-y-1.5 text-center", starting && "animate-boot-copy-exit")}>
          <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">MFX AI Assistant</h2>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)] opacity-70">
            Your personal trading coach is standing by — trained on every trade, note, and pattern in this journal.
          </p>
        </div>
        <button
          onClick={handleStart}
          disabled={starting}
          className={cn(
            "relative flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)] transition-transform hover:scale-105 active:scale-90 disabled:pointer-events-none",
            starting && "animate-boot-copy-exit",
          )}
        >
          <Power className="h-4 w-4" /> Start
        </button>
      </Card>
    );
  }

  return (
    <Card className="relative flex h-[680px] flex-col overflow-hidden">
      <div
        className="animate-mount-flash pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(circle at 50% 12%, rgba(139,92,246,0.5), transparent 55%)" }}
      />
      <div className="relative flex flex-col items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 text-center">
        <button
          onClick={resetConversation}
          title="New conversation"
          className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="relative flex items-center justify-center">
          <span className="animate-logo-power-ring absolute inset-0 rounded-full border-2 border-[#8b5cf6]" />
          <div className="animate-chat-bubble-in">
            <AiAssistantLogoMark size={64} />
          </div>
        </div>
        <h2 className="animate-chat-bubble-in text-lg font-bold tracking-tight text-[var(--color-text)]" style={{ animationDelay: "90ms" }}>
          MFX AI Assistant
        </h2>
        <p
          className="animate-chat-bubble-in max-w-md text-xs text-[var(--color-text-muted)] opacity-60"
          style={{ animationDelay: "170ms" }}
        >
          Your personal trading coach — trained on every trade, note, and pattern in this journal.
        </p>
        <span
          className="animate-chat-bubble-in rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] opacity-70"
          style={{ animationDelay: "250ms" }}
        >
          {providerConfig.provider === "ollama" ? "Local engine · free" : providerConfig.provider === "groq" ? "Groq engine · free" : "Claude engine"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && starterAlternatives.length > 0 && (
          <div className="mx-auto max-w-md space-y-2.5 pt-2">
            <p
              className="animate-chat-bubble-in flex items-center justify-center gap-1.5 text-center text-xs text-[var(--color-text-muted)]"
              style={{ animationDelay: "460ms" }}
            >
              <Sparkles className="h-3 w-3 text-[#8b5cf6]" /> A question's ready below — or pick one to start:
            </p>
            <div className="flex flex-col gap-2">
              {starterAlternatives.map((q, i) => (
                <button
                  key={`starter-${i}`}
                  onClick={() => send(q)}
                  className="animate-chip-pop group flex items-center gap-2.5 rounded-xl border border-[#8b5cf6]/25 bg-gradient-to-r from-[#8b5cf6]/10 to-[#ec4899]/10 px-4 py-2.5 text-left text-xs text-[var(--color-text)] transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6]/60 hover:shadow-[0_6px_20px_-6px_rgba(139,92,246,0.5)]"
                  style={{ animationDelay: `${560 + i * 130}ms` }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6]/20 text-[10px] font-bold text-[#c4b5fd]">
                    {i + 1}
                  </span>
                  <span className="flex-1">{q}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#8b5cf6] opacity-50 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <ChatBubble message={m} animate={i === messages.length - 1} />
            {i === messages.length - 1 && activeSuggestions.length > 0 && (
              <div className="ml-9 space-y-1.5 pt-1">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#a78bfa]">
                  <Sparkles className="h-3 w-3" /> Continue the conversation
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSuggestions.map((s, si) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{ animationDelay: `${si * 110}ms` }}
                      className="animate-chip-pop group flex items-center gap-1.5 rounded-full border border-[#8b5cf6]/45 bg-gradient-to-r from-[#8b5cf6]/15 to-[#ec4899]/15 px-4 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-[0_0_0_1px_rgba(139,92,246,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6]/80 hover:shadow-[0_6px_20px_-4px_rgba(139,92,246,0.55)]"
                    >
                      {s}
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-[#8b5cf6] opacity-70 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">…or just type your own below.</p>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-end gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <AiAssistantLogoMark size={28} />
            </div>
            <div className="animate-bubble-in-left flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3.5">
              <span className="animate-thinking-dot h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" style={{ animationDelay: "0ms" }} />
              <span className="animate-thinking-dot h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" style={{ animationDelay: "150ms" }} />
              <span className="animate-thinking-dot h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={messages.length === 0 ? starterQuestion : "Ask a follow-up…"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)] placeholder:opacity-70"
        />
        <button
          onClick={() => send()}
          disabled={busy}
          className="text-[#8b5cf6] transition-transform duration-150 hover:scale-110 active:scale-90 disabled:opacity-50 disabled:hover:scale-100"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
