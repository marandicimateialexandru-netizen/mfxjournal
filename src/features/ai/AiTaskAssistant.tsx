import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Maximize2, RotateCcw, Send, Mic, Image as ImageIcon, Camera, MessageSquarePlus, Tags, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSettings } from "@/features/settings/useSettings";
import { useVariables } from "@/features/variables/useVariables";
import { useCustomResults } from "@/features/variables/useAuxLists";
import { callClaude, AiNotConfiguredError, type AiMessage } from "./aiClient";
import { buildTaskAssistantTools } from "./taskAssistantTools";
import * as variablesApi from "@/db/queries/variables";
import * as planningApi from "@/db/queries/planning";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  pendingTool?: { name: string; input: Record<string, unknown> };
}

const SYSTEM_PROMPT = `You are the MFXJournal AI Task Assistant: a scoped agent that helps the trader manage trades, variables, and journal entries through conversation.
You have tools to propose creating a trade, a variable, or a planning entry. ALWAYS use a tool call to propose the action rather than just describing it in text — the user will confirm before anything is actually saved. Keep replies brief and conversational.`;

export function AiTaskAssistant() {
  const { data: settings } = useSettings();
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const open = useUiStore((s) => s.aiTaskAssistantOpen);
  const toggleOpen = useUiStore((s) => s.toggleAiTaskAssistant);
  const openAddTradeModalWithDraft = useUiStore((s) => s.openAddTradeModalWithDraft);
  const { data: variables = [] } = useVariables();
  const { data: customResults = [] } = useCustomResults();
  const queryClient = useQueryClient();

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ data: string; mediaType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (settings?.ai_task_assistant_enabled === 0) return null;

  function reset() {
    setEntries([]);
    setInput("");
    setPendingImage(null);
  }

  async function send(text: string) {
    if (!text.trim() && !pendingImage) return;
    const userEntry: ChatEntry = { role: "user", text };
    setEntries((prev) => [...prev, userEntry]);
    setInput("");
    setBusy(true);

    try {
      const content: AiMessage["content"] = pendingImage
        ? [
            { type: "image", source: { type: "base64", media_type: pendingImage.mediaType, data: pendingImage.data } },
            { type: "text", text: text || "Extract this trade from the screenshot." },
          ]
        : text;

      const result = await callClaude({
        apiKey: settings?.ai_api_key,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        tools: buildTaskAssistantTools(variables, customResults),
        maxTokens: 1024,
      });
      setPendingImage(null);

      if (result.toolUses.length > 0) {
        const tool = result.toolUses[0];
        if (tool.name === "create_trade") {
          const input = tool.input as Record<string, unknown>;
          openAddTradeModalWithDraft({
            entry_time: input.entry_time_iso,
            outcome: input.outcome,
            result_r: input.result_r,
            risk_r: input.risk_r,
            market: input.market,
            notes: input.notes,
            variableValues: input.variableValues,
          });
          setEntries((prev) => [
            ...prev,
            { role: "assistant", text: result.text || "I've pre-filled a trade for you — review it and hit Save." },
          ]);
        } else {
          setEntries((prev) => [
            ...prev,
            {
              role: "assistant",
              text: result.text || "Here's what I'd like to create:",
              pendingTool: { name: tool.name, input: tool.input },
            },
          ]);
        }
      } else {
        setEntries((prev) => [...prev, { role: "assistant", text: result.text }]);
      }
    } catch (err) {
      const message = err instanceof AiNotConfiguredError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
      setEntries((prev) => [...prev, { role: "assistant", text: message }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTool(entry: ChatEntry) {
    if (!entry.pendingTool || !workspaceId) return;
    const { name, input } = entry.pendingTool;
    if (name === "create_variable") {
      await variablesApi.createVariable(workspaceId, {
        key: String(input.label).toLowerCase().replace(/\s+/g, "_"),
        label: String(input.label),
        type: (input.type as "text" | "number") ?? "text",
        icon: (input.icon as string) ?? null,
        firstValue: input.firstValue as string | undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["variables", workspaceId] });
    } else if (name === "create_planning_entry") {
      await planningApi.createPlanningEntry(workspaceId, {
        period: (input.period as "daily" | "weekly" | "monthly" | "yearly") ?? "daily",
        date_start: (input.date_start_iso as string) ?? new Date().toISOString(),
        title: input.title as string | undefined,
        mood: input.mood as number | undefined,
        energy: input.energy as number | undefined,
        confidence: input.confidence as number | undefined,
        journal_text: input.journal_text as string | undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["planningEntries", workspaceId] });
    }
    setEntries((prev) => prev.map((e) => (e === entry ? { ...e, pendingTool: undefined, text: e.text + "\n\n✓ Done." } : e)));
  }

  async function handleImagePick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [, base64] = dataUrl.split(",");
      setPendingImage({ data: base64, mediaType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const quickActions = [
    { icon: Camera, label: "Add from screenshot", action: () => handleImagePick() },
    { icon: MessageSquarePlus, label: "Log trade", action: () => setInput("Log a trade: ") },
    { icon: Tags, label: "Add variable", action: () => setInput("Add a variable called ") },
    { icon: CalendarPlus, label: "Journal entry", action: () => setInput("Add a journal entry: ") },
  ];

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {!open && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-lg hover:opacity-90"
          aria-label="Open AI Task Assistant"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed z-40 flex flex-col border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-all",
            expanded ? "inset-4 rounded-lg" : "bottom-6 right-6 h-[560px] w-[380px] rounded-lg",
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              <div>
                <div className="text-sm font-medium">AI Task Assistant</div>
                <div className="text-xs text-[var(--color-text-muted)]">Ready To Help</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
              <button onClick={reset} className="hover:text-[var(--color-text)]" aria-label="Reset">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => setExpanded((v) => !v)} className="hover:text-[var(--color-text)]" aria-label="Expand">
                <Maximize2 className="h-4 w-4" />
              </button>
              <button onClick={toggleOpen} className="hover:text-[var(--color-text)]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {entries.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text)]">
                  Hey there! I'm here to help you manage your trades, variables, and journal entries. What would you
                  like to do?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={qa.action}
                      className="flex flex-col items-start gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 text-left text-xs hover:border-[var(--color-primary)]"
                    >
                      <qa.icon className="h-4 w-4 text-[var(--color-primary)]" />
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.map((entry, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap", entry.role === "user" ? "ml-auto bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-background)] text-[var(--color-text)]")}>
                {entry.text}
                {entry.pendingTool && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => confirmTool(entry)}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEntries((prev) => prev.map((e) => (e === entry ? { ...e, pendingTool: undefined } : e)))}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="text-xs text-[var(--color-text-muted)]">Thinking…</div>}
          </div>

          {pendingImage && (
            <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <ImageIcon className="h-3.5 w-3.5" /> Image attached
              <button onClick={() => setPendingImage(null)} className="ml-auto hover:text-[var(--color-text)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
            <button onClick={handleImagePick} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <ImageIcon className="h-4 w-4" />
            </button>
            <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Voice input">
              <Mic className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Tell me what you'd like to do…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
            />
            <button onClick={() => send(input)} disabled={busy} className="text-[var(--color-primary)] disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
