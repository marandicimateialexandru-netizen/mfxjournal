import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useVariables, useVariableMutations } from "@/features/variables/useVariables";
import { useCustomResults, useMarkets, useAccounts, useStreakThresholds } from "@/features/variables/useAuxLists";
import type { VariableType } from "@/db/types";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function VariablesPage() {
  const { data: variables = [] } = useVariables();
  const mutations = useVariableMutations();
  const customResults = useCustomResults();
  const markets = useMarkets();
  const accounts = useAccounts();
  const streaks = useStreakThresholds();

  const [newVarOpen, setNewVarOpen] = useState(false);
  const [newVarType, setNewVarType] = useState<VariableType>("text");
  const [newVarLabel, setNewVarLabel] = useState("");
  const [newVarFirstValue, setNewVarFirstValue] = useState("");
  const [newValueDrafts, setNewValueDrafts] = useState<Record<string, string>>({});
  const [newMarket, setNewMarket] = useState("");
  const [newCustomResult, setNewCustomResult] = useState("");
  const [newCustomResultMapsTo, setNewCustomResultMapsTo] = useState<"win" | "loss" | "be">("be");
  const [newThreshold, setNewThreshold] = useState("");

  async function handleCreateVariable() {
    if (!newVarLabel.trim()) return;
    await mutations.createVariable.mutateAsync({
      key: newVarLabel.toLowerCase().replace(/\s+/g, "_"),
      label: newVarLabel,
      type: newVarType,
      firstValue: newVarType === "text" ? newVarFirstValue || undefined : undefined,
    });
    setNewVarOpen(false);
    setNewVarLabel("");
    setNewVarFirstValue("");
    setNewVarType("text");
  }

  function move<T extends { id: string; sort_order: number }>(list: T[], id: string, dir: -1 | 1): T[] {
    const idx = list.findIndex((x) => x.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return list;
    const copy = [...list];
    [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
    return copy;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Variables</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Drag to reorder variables and their values</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutations.clearAll.mutate()}>
            Clear Variables
          </Button>
          <Button size="sm" onClick={() => setNewVarOpen(true)}>
            <Plus className="h-4 w-4" /> New Variable
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Days of Week (auto) */}
        <Card>
          <CardHeader>
            <CardTitle>Days of Week</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d) => (
              <Badge key={d} variant="outline">
                {d}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Months (auto) */}
        <Card>
          <CardHeader>
            <CardTitle>Months</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {MONTH_LABELS.map((m) => (
              <Badge key={m} variant="outline">
                {m}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Time of Day (auto) */}
        <Card>
          <CardHeader>
            <CardTitle>Time of Day</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-text-muted)]">
            Auto-generated from trade timestamps. Window size and calculate-by are configured on the Report and
            Dashboard's Time of Day views.
          </CardContent>
        </Card>

        {/* Custom Results */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="win">Win (Default)</Badge>
              <Badge variant="loss">Loss (Default)</Badge>
              <Badge variant="be">Break Even (Default)</Badge>
              {customResults.data?.map((c) => (
                <Badge key={c.id} variant={c.maps_to} className="gap-1">
                  {c.label} → {c.maps_to}
                  <button onClick={() => customResults.remove.mutate(c.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="New result label"
                value={newCustomResult}
                onChange={(e) => setNewCustomResult(e.target.value)}
                className="h-8"
              />
              <Select value={newCustomResultMapsTo} onValueChange={(v) => setNewCustomResultMapsTo(v as any)}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="be">BE</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  if (!newCustomResult.trim()) return;
                  customResults.create.mutate({ label: newCustomResult, mapsTo: newCustomResultMapsTo });
                  setNewCustomResult("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Markets */}
        <Card>
          <CardHeader>
            <CardTitle>Markets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {markets.data?.map((m) => (
                <Badge key={m.id} variant="outline" className="gap-1">
                  {m.symbol}
                  <button onClick={() => markets.remove.mutate(m.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input placeholder="e.g. EURUSD" value={newMarket} onChange={(e) => setNewMarket(e.target.value)} className="h-8" />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  if (!newMarket.trim()) return;
                  markets.create.mutate(newMarket.toUpperCase());
                  setNewMarket("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Streak Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Streak Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {streaks.data?.map((s) => (
                <Badge key={s.id} variant="outline" className="gap-1">
                  {s.threshold}+
                  <button onClick={() => streaks.remove.mutate(s.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="Add threshold"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="h-8"
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  const n = Number(newThreshold);
                  if (!n) return;
                  streaks.add.mutate({ threshold: n, beBreaksStreak: true });
                  setNewThreshold("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Switch defaultChecked /> Break-evens break streaks
            </label>
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {accounts.data?.map((a) => (
                <Badge key={a.id} variant="outline" className="gap-1">
                  {a.name}
                  <button onClick={() => accounts.remove.mutate(a.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                placeholder="e.g. Funded #1"
                value={newValueDrafts["__account"] ?? ""}
                onChange={(e) => setNewValueDrafts((p) => ({ ...p, __account: e.target.value }))}
                className="h-8"
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  const v = newValueDrafts["__account"];
                  if (!v?.trim()) return;
                  accounts.create.mutate(v);
                  setNewValueDrafts((p) => ({ ...p, __account: "" }));
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom variables */}
        {variables.map((v) => (
          <Card key={v.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[var(--color-text)]">
                {v.icon} {v.label}{" "}
                <span className="text-xs text-[var(--color-text-muted)]">({v.type})</span>
              </CardTitle>
              <button
                onClick={() => mutations.deleteVariable.mutate(v.id)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-2">
              {v.type === "text" && (
                <>
                  <div className="space-y-1">
                    {v.values.map((val, i) => (
                      <div key={val.id} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1">
                        <span className="flex-1 text-sm">
                          {val.icon} {val.label}
                        </span>
                        <button
                          disabled={i === 0}
                          onClick={() => mutations.reorderVariables.mutate(move(v.values, val.id, -1).map((x) => x.id))}
                          className="disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={i === v.values.length - 1}
                          onClick={() => mutations.reorderVariables.mutate(move(v.values, val.id, 1).map((x) => x.id))}
                          className="disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => mutations.deleteValue.mutate(val.id)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Add value"
                      value={newValueDrafts[v.id] ?? ""}
                      onChange={(e) => setNewValueDrafts((p) => ({ ...p, [v.id]: e.target.value }))}
                      className="h-8"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => {
                        const val = newValueDrafts[v.id];
                        if (!val?.trim()) return;
                        mutations.addValue.mutate({ variableId: v.id, label: val });
                        setNewValueDrafts((p) => ({ ...p, [v.id]: "" }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
              {v.type === "number" && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Numeric variable — values are entered per-trade in the Journal form.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={newVarOpen} onOpenChange={setNewVarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Variable Type</Label>
              <Select value={newVarType} onValueChange={(v) => setNewVarType(v as VariableType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (select from options)</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newVarLabel} onChange={(e) => setNewVarLabel(e.target.value)} placeholder="e.g. Setup" />
            </div>
            {newVarType === "text" && (
              <div className="space-y-1.5">
                <Label>First Value</Label>
                <Input value={newVarFirstValue} onChange={(e) => setNewVarFirstValue(e.target.value)} placeholder="e.g. OTE" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVarOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateVariable}>Create Variable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
