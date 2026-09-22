import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mic,
  Info,
  X,
  Trash2,
  Loader2,
  Check,
  CalendarClock,
  Tags,
  StickyNote,
  Camera,
  LogIn,
  Layers,
  CandlestickChart,
  Sparkles,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconBadge } from "@/components/shared/IconBadge";
import { getTradingIcon, LiquidityIcon } from "@/components/shared/tradingIcons";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useVariables } from "@/features/variables/useVariables";
import { useCustomResults } from "@/features/variables/useAuxLists";
import { useStrategies } from "@/features/strategy/useStrategies";
import { useTradeMutations, useTrade } from "./useTrades";
import { parseVoiceTrade } from "@/features/ai/voiceFill";
import { useSettings } from "@/features/settings/useSettings";
import { copyScreenshotsToAppData } from "@/lib/screenshots";

const schema = z.object({
  entry_time: z.string().min(1, "Required"),
  hasEndDate: z.boolean(),
  end_time: z.string().optional(),
  outcome: z.string().min(1, "Required"),
  risk_r: z.string().optional(),
  result_r: z.string().min(1, "Required"),
  market: z.string().optional(),
  strategy_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SectionHeader({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

const OUTCOME_STYLES: Record<"win" | "loss" | "be", { active: string; ring: string }> = {
  win: { active: "border-[var(--color-success)] bg-[var(--color-success)]/15 text-[var(--color-success)]", ring: "ring-[var(--color-success)]/40" },
  loss: { active: "border-[var(--color-danger)] bg-[var(--color-danger)]/15 text-[var(--color-danger)]", ring: "ring-[var(--color-danger)]/40" },
  be: { active: "border-[var(--color-warning)] bg-[var(--color-warning)]/15 text-[var(--color-warning)]", ring: "ring-[var(--color-warning)]/40" },
};

export function AddTradeModal() {
  const open = useUiStore((s) => s.addTradeModalOpen);
  const editingTradeId = useUiStore((s) => s.editingTradeId);
  const draftTrade = useUiStore((s) => s.draftTrade);
  const close = useUiStore((s) => s.closeAddTradeModal);

  const { data: variables = [] } = useVariables();
  const { data: customResults = [] } = useCustomResults();
  const { data: strategies = [] } = useStrategies();
  const { data: settings } = useSettings();
  const { data: existingTrade } = useTrade(editingTradeId);
  const { createTrade, updateTrade, deleteTrade } = useTradeMutations();

  const [variableValues, setVariableValues] = useState<Record<string, { valueId?: string; numberValue?: number }>>({});
  const [entryScreenshot, setEntryScreenshot] = useState<string | null>(null);
  const [liquidityScreenshot, setLiquidityScreenshot] = useState<string | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [liquidityBusy, setLiquidityBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "processing">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entry_time: toDatetimeLocal(new Date().toISOString()),
      hasEndDate: false,
      outcome: "win",
      result_r: "",
      risk_r: "1",
    },
  });

  const hasEndDate = watch("hasEndDate");
  const resultR = watch("result_r");

  useEffect(() => {
    if (open && existingTrade) {
      reset({
        entry_time: toDatetimeLocal(existingTrade.entry_time),
        hasEndDate: !!existingTrade.end_time,
        end_time: toDatetimeLocal(existingTrade.end_time),
        outcome: existingTrade.outcome,
        risk_r: existingTrade.risk_r != null ? String(existingTrade.risk_r) : "",
        result_r: String(existingTrade.result_r),
        market: existingTrade.market ?? "",
        strategy_id: existingTrade.strategy_id ?? undefined,
        notes: existingTrade.notes ?? "",
      });
      setVariableValues(existingTrade.variableValues ?? {});
      setEntryScreenshot(existingTrade.screenshots?.find((s) => s.label === "Entry")?.file_path ?? null);
      setLiquidityScreenshot(existingTrade.screenshots?.find((s) => s.label === "Liquidity")?.file_path ?? null);
    } else if (open && !existingTrade && draftTrade) {
      reset({
        entry_time: toDatetimeLocal((draftTrade.entry_time as string) ?? new Date().toISOString()),
        hasEndDate: false,
        outcome: (draftTrade.outcome as string) ?? "win",
        result_r: draftTrade.result_r != null ? String(draftTrade.result_r) : "",
        risk_r: draftTrade.risk_r != null ? String(draftTrade.risk_r) : "1",
        market: (draftTrade.market as string) ?? "",
        strategy_id: undefined,
        notes: (draftTrade.notes as string) ?? "",
      });
      setVariableValues((draftTrade.variableValues as Record<string, { valueId?: string; numberValue?: number }>) ?? {});
      setEntryScreenshot(null);
      setLiquidityScreenshot(null);
    } else if (open && !existingTrade && !draftTrade) {
      reset({
        entry_time: toDatetimeLocal(new Date().toISOString()),
        hasEndDate: false,
        outcome: "win",
        result_r: "",
        risk_r: "1",
        market: "",
        strategy_id: undefined,
        notes: "",
      });
      setVariableValues({});
      setEntryScreenshot(null);
      setLiquidityScreenshot(null);
    }
  }, [open, existingTrade, draftTrade, reset]);

  const outcomeOptions = useMemo(
    () => [
      { id: "win", label: "Win", mapsTo: "win" as const, icon: null as string | null },
      { id: "loss", label: "Loss", mapsTo: "loss" as const, icon: null as string | null },
      { id: "be", label: "Break Even", mapsTo: "be" as const, icon: null as string | null },
      ...customResults.map((c) => ({ id: c.id, label: c.label, mapsTo: c.maps_to, icon: c.icon })),
    ],
    [customResults],
  );

  async function onSubmit(values: FormValues) {
    const screenshots = [
      entryScreenshot ? { path: entryScreenshot, label: "Entry" } : null,
      liquidityScreenshot ? { path: liquidityScreenshot, label: "Liquidity" } : null,
    ].filter((s): s is { path: string; label: string } => s !== null);

    const input = {
      entry_time: new Date(values.entry_time).toISOString(),
      end_time: values.hasEndDate && values.end_time ? new Date(values.end_time).toISOString() : null,
      outcome: values.outcome,
      risk_r: values.risk_r ? Number(values.risk_r) : null,
      result_r: Number(values.result_r),
      market: values.market || null,
      strategy_id: values.strategy_id || null,
      notes: values.notes || null,
      variableValues,
      screenshots,
    };
    if (existingTrade) {
      await updateTrade.mutateAsync({ id: existingTrade.id, input });
    } else {
      await createTrade.mutateAsync(input);
    }
    close();
  }

  async function handleUploadSlot(slot: "Entry" | "Liquidity") {
    const setBusy = slot === "Entry" ? setEntryBusy : setLiquidityBusy;
    const setPath = slot === "Entry" ? setEntryScreenshot : setLiquidityScreenshot;
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (!selected) return;
      setBusy(true);
      const [copied] = await copyScreenshotsToAppData([selected as string]);
      setPath(copied);
    } catch (err) {
      console.warn("Screenshot picker unavailable in this environment", err);
    } finally {
      setBusy(false);
    }
  }

  const voiceInputEnabled = settings?.voice_input_enabled !== 0;
  const speechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  async function handleVoiceFill() {
    setVoiceError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice input isn't supported in this webview.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    setVoiceStatus("listening");

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      setVoiceStatus("processing");
      try {
        const parsed = await parseVoiceTrade(transcript, {
          apiKey: settings?.ai_api_key ?? null,
          variables,
          customResults,
        });
        if (parsed.outcome) setValue("outcome", parsed.outcome);
        if (parsed.resultR != null) setValue("result_r", String(parsed.resultR));
        if (parsed.riskR != null) setValue("risk_r", String(parsed.riskR));
        if (parsed.market) setValue("market", parsed.market);
        if (parsed.variableValues) {
          setVariableValues((prev) => ({ ...prev, ...parsed.variableValues }));
        }
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "Couldn't parse that.");
      } finally {
        setVoiceStatus("idle");
      }
    };
    recognition.onerror = () => {
      setVoiceStatus("idle");
      setVoiceError("Didn't catch that — try again.");
    };
    recognition.start();
  }

  const resultTone = resultR ? (Number(resultR) > 0 ? "positive" : Number(resultR) < 0 ? "negative" : "neutral") : "neutral";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <IconBadge icon={CandlestickChart} tone="violet" size={34} className="shrink-0" />
            <div className="min-w-0">
              <DialogTitle>{existingTrade ? "Edit Trade" : "New Trade"}</DialogTitle>
              <p className="text-xs text-[var(--color-text-muted)]">
                {existingTrade ? "Update the details of this trade" : "Log a trade and tag it against your variables"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {voiceInputEnabled && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-primary)]/30 bg-gradient-to-r from-[var(--color-primary)]/10 to-transparent p-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleVoiceFill}
                disabled={voiceStatus !== "idle" || !speechSupported}
              >
                {voiceStatus === "idle" ? <Sparkles className="h-4 w-4" /> : <Mic className="h-4 w-4 animate-pulse" />}
                {voiceStatus === "listening" ? "Listening…" : voiceStatus === "processing" ? "Parsing…" : "Voice Fill"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Say things like "Win, 2R, EURUSD, setup OTE". You can also say "change setup to BOS"
                  to correct fields, or "today at 8am" for dates.
                </TooltipContent>
              </Tooltip>
              {!speechSupported && (
                <span className="text-xs text-[var(--color-text-muted)]">Not supported in this webview</span>
              )}
              {voiceError && <span className="text-xs text-[var(--color-danger)]">{voiceError}</span>}
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/50 p-3.5">
            <SectionHeader icon={CalendarClock}>Trade Details</SectionHeader>

            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Controller
                control={control}
                name="outcome"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-1.5">
                    {outcomeOptions.map((o) => {
                      const active = field.value === o.id;
                      const style = OUTCOME_STYLES[o.mapsTo];
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => field.onChange(o.id)}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                            active
                              ? cn(style.active, "ring-2", style.ring)
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                          )}
                        >
                          {active && <Check className="h-3.5 w-3.5" />}
                          {o.icon && <span>{o.icon}</span>}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entry Date & Time</Label>
                <Input type="datetime-local" {...register("entry_time")} />
                {errors.entry_time && <p className="text-xs text-[var(--color-danger)]">{errors.entry_time.message}</p>}
                <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <input type="checkbox" {...register("hasEndDate")} /> Add end date
                </label>
                {hasEndDate && <Input type="datetime-local" {...register("end_time")} />}
              </div>

              <div className="space-y-1.5">
                <Label>Market</Label>
                <Input placeholder="EURUSD" {...register("market")} />
              </div>

              <div className="space-y-1.5">
                <Label>Risk (R)</Label>
                <Input type="number" step="0.1" {...register("risk_r")} />
              </div>

              <div className="space-y-1.5">
                <Label>Result (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("result_r")}
                  className={cn(
                    "font-semibold tabular-nums",
                    resultTone === "positive" && "text-[var(--color-success)]",
                    resultTone === "negative" && "text-[var(--color-danger)]",
                  )}
                />
                {errors.result_r && <p className="text-xs text-[var(--color-danger)]">{errors.result_r.message}</p>}
              </div>

              {strategies.length > 0 && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Strategy
                  </Label>
                  <Controller
                    control={control}
                    name="strategy_id"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          {strategies.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.icon} {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {variables.length > 0 && (
            <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/50 p-3.5">
              <SectionHeader icon={Tags}>Variables</SectionHeader>
              <div className="grid grid-cols-2 gap-3">
                {variables.map((v) => {
                  const match = getTradingIcon(v.label) ?? getTradingIcon(v.key);
                  return (
                    <div key={v.id} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        {match ? (
                          <IconBadge icon={match.icon} tone={match.tone} size={18} />
                        ) : v.icon ? (
                          <span>{v.icon}</span>
                        ) : null}
                        {v.label}
                      </Label>
                      {v.type === "text" ? (
                        <Select
                          value={variableValues[v.id]?.valueId ?? ""}
                          onValueChange={(val) =>
                            setVariableValues((prev) => ({ ...prev, [v.id]: { valueId: val } }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {v.values.map((val) => (
                              <SelectItem key={val.id} value={val.id}>
                                {val.icon} {val.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          step="any"
                          value={variableValues[v.id]?.numberValue ?? ""}
                          onChange={(e) =>
                            setVariableValues((prev) => ({
                              ...prev,
                              [v.id]: { numberValue: e.target.value === "" ? undefined : Number(e.target.value) },
                            }))
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <SectionHeader icon={StickyNote}>Notes</SectionHeader>
            <Textarea rows={3} placeholder="What happened? What did you learn?" {...register("notes")} />
          </div>

          <div className="space-y-1.5">
            <SectionHeader icon={Camera}>Screenshots</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <ScreenshotSlot
                label="Entry"
                icon={LogIn}
                tone="teal"
                path={entryScreenshot}
                busy={entryBusy}
                onUpload={() => handleUploadSlot("Entry")}
                onClear={() => setEntryScreenshot(null)}
              />
              <ScreenshotSlot
                label="Liquidity"
                icon={LiquidityIcon}
                tone="blue"
                path={liquidityScreenshot}
                busy={liquidityBusy}
                onUpload={() => handleUploadSlot("Liquidity")}
                onClear={() => setLiquidityScreenshot(null)}
              />
            </div>
          </div>

          <DialogFooter>
            {existingTrade && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={async () => {
                  await deleteTrade.mutateAsync(existingTrade.id);
                  close();
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Check className="h-4 w-4" /> Save Trade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScreenshotSlot({
  label,
  icon: Icon,
  tone,
  path,
  busy,
  onUpload,
  onClear,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  tone: Parameters<typeof IconBadge>[0]["tone"];
  path: string | null;
  busy: boolean;
  onUpload: () => void;
  onClear: () => void;
}) {
  if (path) {
    return (
      <div className="group relative h-40 overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm">
        <img src={convertFileSrc(path)} alt={label} className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <Button type="button" size="sm" variant="secondary" onClick={onUpload}>
            Replace
          </Button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full bg-[var(--color-danger)] p-1.5"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onUpload}
      disabled={busy}
      className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text)] disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <IconBadge icon={Icon} tone={tone} size={36} />
      )}
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px]">Click to upload</span>
    </button>
  );
}
