import { useState } from "react";
import { ChevronDown, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { newId } from "@/lib/id";
import type { CombinationFilter, CombinationVariableOption } from "@/features/stats/combinationFilters";

export interface DisplaySettings {
  showWinRate: boolean;
  showBeRate: boolean;
  showTotal: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = { showWinRate: true, showBeRate: true, showTotal: true };

interface DraftFilter {
  key: string;
  variableId: string | null;
  include: boolean;
  valueIds: string[];
}

function toDraftFilters(filters: CombinationFilter[]): DraftFilter[] {
  if (filters.length === 0) return [{ key: newId(), variableId: null, include: true, valueIds: [] }];
  return filters.map((f) => ({ key: newId(), variableId: f.variableId, include: f.include, valueIds: f.valueIds }));
}

export interface CombinationDraft {
  name: string;
  filters: CombinationFilter[];
  displaySettings: DisplaySettings;
}

export function CombinationBuilder({
  variableOptions,
  initial,
  onCancel,
  onSave,
  saving,
}: {
  variableOptions: CombinationVariableOption[];
  initial?: CombinationDraft | null;
  onCancel: () => void;
  onSave: (draft: CombinationDraft) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [filters, setFilters] = useState<DraftFilter[]>(() => toDraftFilters(initial?.filters ?? []));
  const [display, setDisplay] = useState<DisplaySettings>(initial?.displaySettings ?? DEFAULT_DISPLAY_SETTINGS);
  const [displayOpen, setDisplayOpen] = useState(false);

  function updateFilter(key: string, patch: Partial<DraftFilter>) {
    setFilters((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function removeFilter(key: string) {
    setFilters((prev) => prev.filter((f) => f.key !== key));
  }

  function addFilter() {
    setFilters((prev) => [...prev, { key: newId(), variableId: null, include: true, valueIds: [] }]);
  }

  const validFilters: CombinationFilter[] = filters
    .filter((f) => f.variableId && f.valueIds.length > 0)
    .map((f) => ({ variableId: f.variableId!, include: f.include, valueIds: f.valueIds }));

  const canSave = name.trim().length > 0 && validFilters.length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({ name: name.trim(), filters: validFilters, displaySettings: display });
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
      <div className="space-y-1.5">
        <Label>Combination name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Combination name (e.g., Morning Longs on NQ)"
        />
      </div>

      <div className="space-y-2.5">
        {filters.map((f) => (
          <FilterRow
            key={f.key}
            filter={f}
            variableOptions={variableOptions}
            onChange={(patch) => updateFilter(f.key, patch)}
            onRemove={() => removeFilter(f.key)}
          />
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={addFilter}>
        <Plus className="h-3.5 w-3.5" /> Add Filter
      </Button>

      <div className="rounded-md border border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setDisplayOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        >
          Display Settings
          <ChevronDown className={cn("h-4 w-4 text-[var(--color-text-muted)] transition-transform", !displayOpen && "-rotate-90")} />
        </button>
        {displayOpen && (
          <div className="space-y-2.5 border-t border-[var(--color-border)] p-3">
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">Show Win Rate</span>
              <Switch checked={display.showWinRate} onCheckedChange={(v) => setDisplay((d) => ({ ...d, showWinRate: v }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">Show BE Rate</span>
              <Switch checked={display.showBeRate} onCheckedChange={(v) => setDisplay((d) => ({ ...d, showBeRate: v }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">Show Total</span>
              <Switch checked={display.showTotal} onCheckedChange={(v) => setDisplay((d) => ({ ...d, showTotal: v }))} />
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          Save Combination
        </Button>
      </div>
    </div>
  );
}

function FilterRow({
  filter,
  variableOptions,
  onChange,
  onRemove,
}: {
  filter: DraftFilter;
  variableOptions: CombinationVariableOption[];
  onChange: (patch: Partial<DraftFilter>) => void;
  onRemove: () => void;
}) {
  const variable = variableOptions.find((v) => v.id === filter.variableId);

  function toggleValue(valueId: string) {
    const has = filter.valueIds.includes(valueId);
    onChange({ valueIds: has ? filter.valueIds.filter((id) => id !== valueId) : [...filter.valueIds, valueId] });
  }

  const activeClass = filter.include
    ? "border-[var(--color-success)]/40 bg-[var(--color-success)]/15 text-[var(--color-success)]"
    : "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/15 text-[var(--color-danger)]";

  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ include: !filter.include })}
          className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", activeClass)}
        >
          {filter.include ? "Include" : "Exclude"}
        </button>
        <Select value={filter.variableId ?? ""} onValueChange={(v) => onChange({ variableId: v, valueIds: [] })}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="Select variable..." />
          </SelectTrigger>
          <SelectContent>
            {variableOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.icon ? `${v.icon} ` : ""}
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {variable && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {variable.values.length === 0 ? (
            <span className="text-xs text-[var(--color-text-muted)]">No values configured for this variable yet.</span>
          ) : (
            variable.values.map((val) => {
              const selected = filter.valueIds.includes(val.id);
              return (
                <button
                  key={val.id}
                  type="button"
                  onClick={() => toggleValue(val.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selected ? activeClass : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                  {val.icon && <span>{val.icon}</span>}
                  {val.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
