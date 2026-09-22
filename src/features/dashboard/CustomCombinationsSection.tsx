import { useMemo, useState } from "react";
import { FlaskConical, Plus, Pencil, Trash2 } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPct } from "@/lib/format";
import { useStats } from "@/features/stats/useStats";
import { useMarkets } from "@/features/variables/useAuxLists";
import { useCombinations } from "@/features/variables/useCombinations";
import { buildCombinationVariableOptions, applyCombinationFilters, type CombinationFilter } from "@/features/stats/combinationFilters";
import { computeStats } from "@/features/stats/computeStats";
import { CombinationBuilder, DEFAULT_DISPLAY_SETTINGS, type CombinationDraft, type DisplaySettings } from "@/features/dashboard/CombinationBuilder";
import type { CustomCombination } from "@/db/types";

function parseFilters(raw: string): CombinationFilter[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDisplaySettings(raw: string | null): DisplaySettings {
  if (!raw) return DEFAULT_DISPLAY_SETTINGS;
  try {
    return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function CustomCombinationsSection() {
  const { stats, customResults, variables } = useStats();
  const { data: markets = [] } = useMarkets();
  const combinations = useCombinations();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const variableOptions = useMemo(() => buildCombinationVariableOptions(variables, markets), [variables, markets]);

  const combos = combinations.data ?? [];
  const editingCombo = editingId ? combos.find((c) => c.id === editingId) ?? null : null;
  const editingDraft: CombinationDraft | null = editingCombo
    ? {
        name: editingCombo.name,
        filters: parseFilters(editingCombo.filters),
        displaySettings: parseDisplaySettings(editingCombo.display_settings),
      }
    : null;

  function openCreate() {
    setEditingId(null);
    setBuilderOpen(true);
  }

  function openEdit(combo: CustomCombination) {
    setEditingId(combo.id);
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditingId(null);
  }

  async function handleSave(draft: CombinationDraft) {
    const payload = {
      name: draft.name,
      filters: JSON.stringify(draft.filters),
      displaySettings: JSON.stringify(draft.displaySettings),
    };
    if (editingId) {
      await combinations.update.mutateAsync({ id: editingId, patch: { name: payload.name, filters: payload.filters, display_settings: payload.displaySettings } });
    } else {
      await combinations.create.mutateAsync(payload);
    }
    closeBuilder();
  }

  const headerRight =
    !builderOpen && combos.length > 0 ? (
      <Button variant="outline" size="sm" onClick={openCreate}>
        <Plus className="h-3.5 w-3.5" /> New Combination
      </Button>
    ) : undefined;

  return (
    <CollapsibleSection
      title="Custom Combinations"
      subtitle={combos.length > 0 ? `${combos.length} saved combination${combos.length === 1 ? "" : "s"}` : undefined}
      icon={FlaskConical}
      tone="teal"
      headerRight={headerRight}
    >
      {builderOpen ? (
        <CombinationBuilder
          variableOptions={variableOptions}
          initial={editingDraft}
          onCancel={closeBuilder}
          onSave={handleSave}
          saving={combinations.create.isPending || combinations.update.isPending}
        />
      ) : combos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FlaskConical className="h-10 w-10 text-[var(--color-text-muted)]" />
          <p className="text-sm font-medium text-[var(--color-text)]">No combinations yet</p>
          <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
            Create combinations of your variables to see performance metrics for specific trade setups
          </p>
          <Button size="sm" className="mt-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Create First Combination
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((combo) => (
            <SavedCombinationCard
              key={combo.id}
              combo={combo}
              baseTrades={stats.filteredTrades}
              customResults={customResults}
              onEdit={() => openEdit(combo)}
              onDelete={() => combinations.remove.mutate(combo.id)}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function SavedCombinationCard({
  combo,
  baseTrades,
  customResults,
  onEdit,
  onDelete,
}: {
  combo: CustomCombination;
  baseTrades: ReturnType<typeof useStats>["stats"]["filteredTrades"];
  customResults: ReturnType<typeof useStats>["customResults"];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const filters = useMemo(() => parseFilters(combo.filters), [combo.filters]);
  const display = useMemo(() => parseDisplaySettings(combo.display_settings), [combo.display_settings]);

  const comboStats = useMemo(() => {
    const matching = applyCombinationFilters(baseTrades, filters);
    return computeStats(matching, { customResults });
  }, [baseTrades, filters, customResults]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="truncate text-[var(--color-text)]">{combo.name}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onEdit} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {display.showTotal && <StatCell label="Total" value={String(comboStats.totalTrades)} />}
        {display.showWinRate && <StatCell label="Win Rate" value={formatPct(comboStats.winRatePct)} tone="success" />}
        {display.showBeRate && <StatCell label="BE Rate" value={formatPct(comboStats.beRatePct)} tone="warning" />}
      </CardContent>
    </Card>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-[var(--color-success)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-text)]";
  return (
    <div className="rounded-md border border-[var(--color-border)] p-2.5">
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
