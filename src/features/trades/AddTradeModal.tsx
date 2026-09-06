import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mic, Info, Image as ImageIcon, X, Trash2, Loader2 } from "lucide-react";
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
  const [screenshots, setScreenshots] = useState<string[]>([]);
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
      setScreenshots((existingTrade.screenshots ?? []).map((s) => s.file_path));
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
      setScreenshots([]);
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
      setScreenshots([]);
    }
  }, [open, existingTrade, draftTrade, reset]);

  const outcomeOptions = useMemo(
    () => [
      { id: "win", label: "Win" },
      { id: "loss", label: "Loss" },
      { id: "be", label: "Break Even" },
      ...customResults.map((c) => ({ id: c.id, label: c.label })),
    ],
    [customResults],
  );

  async function onSubmit(values: FormValues) {
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

  const [screenshotBusy, setScreenshotBusy] = useState(false);

  async function handleAddScreenshot() {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setScreenshotBusy(true);
      const copied = await copyScreenshotsToAppData(paths);
      setScreenshots((prev) => [...prev, ...copied]);
    } catch (err) {
      console.warn("Screenshot picker unavailable in this environment", err);
    } finally {
      setScreenshotBusy(false);
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existingTrade ? "Edit Trade" : "New Trade"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {voiceInputEnabled && (
            <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleVoiceFill}
                disabled={voiceStatus !== "idle" || !speechSupported}
              >
                <Mic className="h-4 w-4" />
                {voiceStatus === "listening" ? "Listening…" : voiceStatus === "processing" ? "Parsing…" : "Voice Fill"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-[var(--color-text-muted)] cursor-help" />
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
              <Label>Outcome</Label>
              <Controller
                control={control}
                name="outcome"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {outcomeOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Risk (R)</Label>
              <Input type="number" step="0.1" {...register("risk_r")} />
            </div>

            <div className="space-y-1.5">
              <Label>Result (R)</Label>
              <Input type="number" step="0.01" {...register("result_r")} />
              {errors.result_r && <p className="text-xs text-[var(--color-danger)]">{errors.result_r.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Market</Label>
              <Input placeholder="EURUSD" {...register("market")} />
            </div>

            {strategies.length > 0 && (
              <div className="space-y-1.5">
                <Label>Strategy</Label>
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

          {variables.length > 0 && (
            <div>
              <Label className="mb-2 block">Variables</Label>
              <div className="grid grid-cols-2 gap-3">
                {variables.map((v) => (
                  <div key={v.id} className="space-y-1.5">
                    <Label className="text-xs text-[var(--color-text-muted)]">
                      {v.icon} {v.label}
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
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} placeholder="What happened? What did you learn?" {...register("notes")} />
          </div>

          <div className="space-y-1.5">
            <Label>Screenshots</Label>
            <div className="flex flex-wrap gap-2">
              {screenshots.map((path, i) => (
                <div
                  key={i}
                  title={path}
                  className="relative h-16 w-16 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
                >
                  <img src={convertFileSrc(path)} alt="Screenshot" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--color-danger)] p-0.5"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddScreenshot}
                disabled={screenshotBusy}
                className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
              >
                {screenshotBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </button>
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
              Save Trade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
