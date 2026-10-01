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
  Receipt,
  SlidersHorizontal,
  NotebookPen,
  Images,
  Calendar,
  Globe2,
  ShieldAlert,
  TrendingUp,
  LogIn,
  Layers,
  CandlestickChart,
  Sparkles,
  RefreshCw,
  ZoomIn,
  Plus,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconBadge } from "@/components/shared/IconBadge";
import { getTradingIcon, LiquidityIcon, TrendIcon } from "@/components/shared/tradingIcons";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useVariables, useVariableMutations } from "@/features/variables/useVariables";
import type { VariableWithValues } from "@/db/queries/variables";
import { useCustomResults } from "@/features/variables/useAuxLists";
import { useStrategies } from "@/features/strategy/useStrategies";
import { useTradeMutations, useTrade } from "./useTrades";
import { parseVoiceTrade } from "@/features/ai/voiceFill";
import { useSettings } from "@/features/settings/useSettings";
import { copyScreenshotsToAppData } from "@/lib/screenshots";
import { ignoreTourOutsideClicks } from "@/features/tour/ignoreTourOutsideClicks";

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

function SectionHeader({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  tone: Parameters<typeof IconBadge>[0]["tone"];
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <IconBadge icon={icon} tone={tone} size={30} className="shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
        {subtitle && <div className="text-[11px] text-[var(--color-text-muted)]">{subtitle}</div>}
      </div>
    </div>
  );
}

/** A small inline icon glyph for field labels — quieter than a SectionHeader badge, just enough to add texture. */
function FieldIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return <Icon className="h-3 w-3 text-[var(--color-text-muted)]" />;
}

/** Matches IconBadge's own gradient palette, so each section's accent bar reads as "the same color" as its badge. */
const TONE_GRADIENT: Record<string, string> = {
  violet: "linear-gradient(90deg, #8b5cf6, #6366f1)",
  green: "linear-gradient(90deg, #34d399, #059669)",
  red: "linear-gradient(90deg, #f87171, #dc2626)",
  amber: "linear-gradient(90deg, #fbbf24, #d97706)",
  teal: "linear-gradient(90deg, #2dd4bf, #0891b2)",
  blue: "linear-gradient(90deg, #60a5fa, #2563eb)",
  rose: "linear-gradient(90deg, #fb7185, #e11d48)",
  slate: "linear-gradient(90deg, #94a3b8, #475569)",
};

/** A consistent elevated panel for every form section — border, subtle surface lift, and a colored accent
 * bar along the top so each section reads as its own distinct "card" instead of blending into the page. */
function SectionCard({
  tone,
  children,
  ...rest
}: { tone: Parameters<typeof IconBadge>[0]["tone"]; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg shadow-black/25 transition-shadow duration-300 focus-within:shadow-xl"
      {...rest}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: TONE_GRADIENT[tone as string] }} />
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

const OUTCOME_STYLES: Record<"win" | "loss" | "be", { active: string; ring: string; glow: string }> = {
  win: {
    active: "border-[var(--color-success)] bg-[var(--color-success)]/15 text-[var(--color-success)]",
    ring: "ring-[var(--color-success)]/40",
    glow: "shadow-[0_0_16px_-2px_var(--color-success)]",
  },
  loss: {
    active: "border-[var(--color-danger)] bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
    ring: "ring-[var(--color-danger)]/40",
    glow: "shadow-[0_0_16px_-2px_var(--color-danger)]",
  },
  be: {
    active: "border-[var(--color-warning)] bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    ring: "ring-[var(--color-warning)]/40",
    glow: "shadow-[0_0_16px_-2px_var(--color-warning)]",
  },
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
  const { addValue } = useVariableMutations();

  const [variableValues, setVariableValues] = useState<Record<string, { valueId?: string; valueIds?: string[]; numberValue?: number }>>({});
  const [entryScreenshot, setEntryScreenshot] = useState<string | null>(null);
  const [liquidityScreenshot, setLiquidityScreenshot] = useState<string | null>(null);
  const [trendScreenshot, setTrendScreenshot] = useState<string | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [liquidityBusy, setLiquidityBusy] = useState(false);
  const [trendBusy, setTrendBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ path: string; label: string } | null>(null);
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
      setTrendScreenshot(existingTrade.screenshots?.find((s) => s.label === "Trend")?.file_path ?? null);
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
      setVariableValues((draftTrade.variableValues as Record<string, { valueId?: string; valueIds?: string[]; numberValue?: number }>) ?? {});
      setEntryScreenshot(null);
      setLiquidityScreenshot(null);
      setTrendScreenshot(null);
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
      setTrendScreenshot(null);
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
      trendScreenshot ? { path: trendScreenshot, label: "Trend" } : null,
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

  async function handleUploadSlot(slot: "Entry" | "Liquidity" | "Trend") {
    const setBusy = slot === "Entry" ? setEntryBusy : slot === "Liquidity" ? setLiquidityBusy : setTrendBusy;
    const setPath = slot === "Entry" ? setEntryScreenshot : slot === "Liquidity" ? setLiquidityScreenshot : setTrendScreenshot;
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
      <DialogContent className="max-w-4xl" data-tour="trade-modal" onInteractOutside={ignoreTourOutsideClicks}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 -z-10 rounded-[10px] bg-[var(--color-primary)] opacity-70 blur-lg" />
              <IconBadge icon={CandlestickChart} tone="violet" size={38} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl">{existingTrade ? "Edit Trade" : "New Trade"}</DialogTitle>
              <p className="text-xs text-[var(--color-text-muted)]">
                {existingTrade ? "Update the details of this trade" : "Log a trade and tag it against your variables"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {voiceInputEnabled && (
            <div className="relative overflow-hidden rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-950 via-indigo-950 to-[var(--color-surface)] p-3 shadow-lg shadow-black/25">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleVoiceFill}
                  disabled={voiceStatus !== "idle" || !speechSupported}
                  className="border-violet-400/50 bg-violet-500/25 hover:bg-violet-500/40"
                >
                  {voiceStatus === "idle" ? <Sparkles className="h-4 w-4 text-violet-200" /> : <Mic className="h-4 w-4 animate-pulse text-violet-200" />}
                  {voiceStatus === "listening" ? "Listening…" : voiceStatus === "processing" ? "Parsing…" : "Voice Fill"}
                </Button>
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm shadow-violet-900">
                  AI
                </span>
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
            </div>
          )}

          <SectionCard tone="blue" data-tour="trade-details">
            <SectionHeader icon={Receipt} tone="blue" title="Trade Details" subtitle="Entry, outcome, risk & market" />

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
                            "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200",
                            active
                              ? cn(style.active, "ring-2 scale-105", style.ring, style.glow)
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:scale-105 hover:text-[var(--color-text)]",
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
                <Label className="flex items-center gap-1">
                  <FieldIcon icon={Calendar} /> Entry Date & Time
                </Label>
                <Controller
                  name="entry_time"
                  control={control}
                  render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} />}
                />
                {errors.entry_time && <p className="text-xs text-[var(--color-danger)]">{errors.entry_time.message}</p>}
                <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <input type="checkbox" {...register("hasEndDate")} /> Add end date
                </label>
                {hasEndDate && (
                  <Controller
                    name="end_time"
                    control={control}
                    render={({ field }) => <DateTimePicker value={field.value ?? ""} onChange={field.onChange} placeholder="Select end date & time" />}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <FieldIcon icon={Globe2} /> Market
                </Label>
                <Input placeholder="EURUSD" {...register("market")} />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <FieldIcon icon={ShieldAlert} /> Risk (R)
                </Label>
                <Input type="number" step="0.1" {...register("risk_r")} />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <FieldIcon icon={TrendingUp} /> Result (R)
                </Label>
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
                    <FieldIcon icon={Layers} /> Strategy
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
          </SectionCard>

          {variables.length > 0 && (
            <SectionCard tone="teal" data-tour="trade-variables">
              <SectionHeader icon={SlidersHorizontal} tone="teal" title="Variables" subtitle={`${variables.length} configured dimension${variables.length === 1 ? "" : "s"}`} />
              <div className="grid grid-cols-2 gap-3">
                {variables.map((v) => {
                  const match = getTradingIcon(v.label) ?? getTradingIcon(v.key);
                  return (
                    <div
                      key={v.id}
                      className="space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 shadow-sm shadow-black/20 transition-colors duration-150 hover:border-[var(--color-primary)]/40 focus-within:border-[var(--color-primary)]/60"
                    >
                      <Label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        {match ? (
                          <IconBadge icon={match.icon} tone={match.tone} size={18} />
                        ) : v.icon ? (
                          <span>{v.icon}</span>
                        ) : null}
                        {v.label}
                      </Label>
                      {v.type === "text" && v.allow_multiple === 1 ? (
                        <MultiValueField
                          variable={v}
                          selectedIds={variableValues[v.id]?.valueIds ?? []}
                          onChange={(ids) => setVariableValues((prev) => ({ ...prev, [v.id]: { valueIds: ids } }))}
                          onAddValue={async (label) => {
                            const created = await addValue.mutateAsync({ variableId: v.id, label });
                            return created.id;
                          }}
                        />
                      ) : v.type === "text" ? (
                        <Select
                          value={variableValues[v.id]?.valueId ?? "__clear__"}
                          onValueChange={(val) =>
                            setVariableValues((prev) => ({ ...prev, [v.id]: val === "__clear__" ? {} : { valueId: val } }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__clear__" className="text-[var(--color-text-muted)]">
                              — Clear —
                            </SelectItem>
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
            </SectionCard>
          )}

          <SectionCard tone="amber" data-tour="trade-notes">
            <SectionHeader icon={NotebookPen} tone="amber" title="Notes" subtitle="What happened, what you learned" />
            <Textarea rows={3} placeholder="What happened? What did you learn?" {...register("notes")} />
          </SectionCard>

          <SectionCard tone="rose" data-tour="trade-screenshots">
            <SectionHeader icon={Images} tone="rose" title="Screenshots" subtitle="Entry, liquidity & trend context" />
            <div className="space-y-3">
              <ScreenshotSlot
                label="Entry"
                icon={LogIn}
                tone="teal"
                path={entryScreenshot}
                busy={entryBusy}
                onUpload={() => handleUploadSlot("Entry")}
                onClear={() => setEntryScreenshot(null)}
                onView={() => entryScreenshot && setLightbox({ path: entryScreenshot, label: "Entry" })}
              />
              <ScreenshotSlot
                label="Liquidity"
                icon={LiquidityIcon}
                tone="blue"
                path={liquidityScreenshot}
                busy={liquidityBusy}
                onUpload={() => handleUploadSlot("Liquidity")}
                onClear={() => setLiquidityScreenshot(null)}
                onView={() => liquidityScreenshot && setLightbox({ path: liquidityScreenshot, label: "Liquidity" })}
              />
              <ScreenshotSlot
                label="Trend"
                icon={TrendIcon}
                tone="green"
                path={trendScreenshot}
                busy={trendBusy}
                onUpload={() => handleUploadSlot("Trend")}
                onClear={() => setTrendScreenshot(null)}
                onView={() => trendScreenshot && setLightbox({ path: trendScreenshot, label: "Trend" })}
              />
            </div>
          </SectionCard>

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

      {lightbox && (
        <ImageLightbox path={lightbox.path} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
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
  onView,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  tone: Parameters<typeof IconBadge>[0]["tone"];
  path: string | null;
  busy: boolean;
  onUpload: () => void;
  onClear: () => void;
  onView: () => void;
}) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setRatio(null);
  }, [path]);

  if (path) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(e) => e.key === "Enter" && onView()}
        style={{ aspectRatio: ratio ?? 16 / 9 }}
        className="group relative w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--color-border)] bg-black shadow-md transition-[box-shadow,aspect-ratio] duration-300 hover:shadow-xl hover:shadow-black/20"
      >
        <img
          src={convertFileSrc(path)}
          alt={label}
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth && el.naturalHeight) setRatio(el.naturalWidth / el.naturalHeight);
          }}
          className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
            <IconBadge icon={Icon} tone={tone} size={26} />
            {label}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            <ZoomIn className="h-3 w-3" /> Click to zoom
          </span>
        </div>
        <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpload();
            }}
            title="Replace"
            className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition-colors hover:bg-[var(--color-primary)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Remove"
            className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition-colors hover:bg-[var(--color-danger)]"
          >
            <X className="h-3.5 w-3.5" />
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
      className="group flex aspect-video w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] transition-all duration-200 hover:scale-[1.01] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-text)] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {busy ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        <div className="transition-transform duration-200 group-hover:scale-110">
          <IconBadge icon={Icon} tone={tone} size={52} />
        </div>
      )}
      <span className="text-base font-semibold">{label}</span>
      <span className="text-xs">Click to upload a screenshot</span>
    </button>
  );
}

/** The Liquidity/News-only control: real trading days often stack more than one of either (HOD +
 *  a local sweep; a data release + a speech), so instead of a single `<Select>` forcing one choice
 *  this renders every currently-tagged value as a removable chip, plus a "+" that opens a small
 *  popover to toggle existing values on/off or type a brand-new one in on the spot — no need to
 *  pre-build every possible combination on the Variables page first. */
function MultiValueField({
  variable,
  selectedIds,
  onChange,
  onAddValue,
}: {
  variable: VariableWithValues;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onAddValue: (label: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  async function handleAddNew() {
    const label = newLabel.trim();
    if (!label || adding) return;
    setAdding(true);
    try {
      const id = await onAddValue(label);
      onChange([...selectedIds, id]);
      setNewLabel("");
    } finally {
      setAdding(false);
    }
  }

  const selectedValues = selectedIds
    .map((id) => variable.values.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => !!v);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {selectedValues.map((val) => (
        <span
          key={val.id}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 py-0.5 pl-2 pr-1 text-xs font-medium text-[var(--color-text)]"
        >
          {val.icon} {val.label}
          <button
            type="button"
            onClick={() => toggle(val.id)}
            className="rounded-full p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
            aria-label={`Remove ${val.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            aria-label={`Add ${variable.label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-2 p-2" align="start">
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {variable.values.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">No values yet — add one below.</p>
            )}
            {variable.values.map((val) => {
              const selected = selectedIds.includes(val.id);
              return (
                <button
                  key={val.id}
                  type="button"
                  onClick={() => toggle(val.id)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-[var(--color-background)]",
                    selected && "font-semibold text-[var(--color-primary)]",
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                  {val.icon} {val.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 border-t border-[var(--color-border)] pt-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New value…"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddNew();
                }
              }}
            />
            <Button type="button" size="sm" className="h-7 px-2" disabled={!newLabel.trim() || adding} onClick={handleAddNew}>
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
