import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, Pencil, GripVertical, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { IconPicker, IconPickerSwatch } from "@/components/shared/IconPicker";
import { cn } from "@/lib/utils";
import { formatR, formatPct } from "@/lib/format";
import { useVariables, useVariableMutations } from "@/features/variables/useVariables";
import {
  useCustomResults,
  useMarkets,
  useAccounts,
  useStreakThresholds,
  useTemplates,
  type TemplateOption,
} from "@/features/variables/useAuxLists";
import { useSettings, useUpdateSettings } from "@/features/settings/useSettings";
import { useTrades } from "@/features/trades/useTrades";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { timeOfDayBuckets } from "@/features/stats/pseudoVariables";
import { applyTemplate, buildTemplateDataFromVariables, type TemplateMapping } from "@/features/variables/applyTemplate";
import { ignoreTourOutsideClicks } from "@/features/tour/ignoreTourOutsideClicks";
import type { VariableType, VariableValue, Trade, CustomResult, Settings } from "@/db/types";
import type { VariableWithValues } from "@/db/queries/variables";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUILTIN_ORDER = ["days_of_week", "time_of_day", "months", "custom_results", "markets", "streak_analysis", "accounts"];
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => ({ value: i, label: `${String(i).padStart(2, "0")}:00` }));

function computeCardOrder(stored: string[] | null, variableIds: string[]): string[] {
  const all = [...BUILTIN_ORDER, ...variableIds];
  const known = new Set(all);
  const base = (stored ?? BUILTIN_ORDER).filter((k) => known.has(k));
  const missing = all.filter((k) => !base.includes(k));
  return [...base, ...missing];
}

function useCardDnd(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return {
    setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 },
    handleProps: { ...attributes, ...listeners },
  };
}

function DragHandle({ handleProps }: { handleProps: Record<string, unknown> }) {
  return (
    <button
      type="button"
      {...handleProps}
      className="cursor-grab touch-none text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

const iconBtn = "text-[var(--color-text-muted)] hover:text-[var(--color-text)]";
const iconBtnDanger = "text-[var(--color-text-muted)] hover:text-[var(--color-danger)]";

export default function VariablesPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);
  const queryClient = useQueryClient();
  const { data: variables = [] } = useVariables();
  const mutations = useVariableMutations();
  const customResults = useCustomResults();
  const markets = useMarkets();
  const accounts = useAccounts();
  const streaks = useStreakThresholds();
  const templates = useTemplates();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: trades = [] } = useTrades();

  const [newVarOpen, setNewVarOpen] = useState(false);
  const [newVarType, setNewVarType] = useState<VariableType>("text");
  const [newVarLabel, setNewVarLabel] = useState("");
  const [newVarFirstValue, setNewVarFirstValue] = useState("");

  const [clearOpen, setClearOpen] = useState(false);

  const [addValueTarget, setAddValueTarget] = useState<VariableWithValues | null>(null);
  const [newValueLabel, setNewValueLabel] = useState("");

  const [editValueTarget, setEditValueTarget] = useState<VariableValue | null>(null);
  const [editValueLabel, setEditValueLabel] = useState("");
  const [editValueIcon, setEditValueIcon] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<VariableWithValues | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameIcon, setRenameIcon] = useState<string | null>(null);

  const [addResultOpen, setAddResultOpen] = useState(false);
  const [resultLabel, setResultLabel] = useState("");
  const [resultIcon, setResultIcon] = useState<string | null>(null);
  const [resultMapsTo, setResultMapsTo] = useState<"win" | "loss" | "be">("win");

  const [newMarket, setNewMarket] = useState("");
  const [addingMarket, setAddingMarket] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [newThreshold, setNewThreshold] = useState("");

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyStep, setApplyStep] = useState<"select" | "map">("select");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [mapping, setMapping] = useState<TemplateMapping>({});
  const [applying, setApplying] = useState(false);

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const cardOrder = useMemo(
    () => computeCardOrder(settings?.variables_card_order ? JSON.parse(settings.variables_card_order) : null, variables.map((v) => v.id)),
    [settings?.variables_card_order, variables],
  );

  const cardSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleCardDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cardOrder.indexOf(String(active.id));
    const newIndex = cardOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(cardOrder, oldIndex, newIndex);
    updateSettings.mutate({ variables_card_order: JSON.stringify(next) });
  }

  async function handleCreateVariable() {
    if (!newVarLabel.trim()) return;
    await mutations.createVariable.mutateAsync({
      key: newVarLabel.toLowerCase().trim().replace(/\s+/g, "_"),
      label: newVarLabel.trim(),
      type: newVarType,
      firstValue: newVarType === "text" ? newVarFirstValue.trim() || undefined : undefined,
    });
    setNewVarOpen(false);
    setNewVarLabel("");
    setNewVarFirstValue("");
    setNewVarType("text");
  }

  function openAddValue(variable: VariableWithValues) {
    setAddValueTarget(variable);
    setNewValueLabel("");
  }

  async function handleAddValue() {
    if (!addValueTarget || !newValueLabel.trim()) return;
    await mutations.addValue.mutateAsync({ variableId: addValueTarget.id, label: newValueLabel.trim() });
    setAddValueTarget(null);
    setNewValueLabel("");
  }

  function openEditValue(value: VariableValue) {
    setEditValueTarget(value);
    setEditValueLabel(value.label);
    setEditValueIcon(value.icon ?? null);
  }

  async function handleSaveValue() {
    if (!editValueTarget || !editValueLabel.trim()) return;
    await mutations.updateValue.mutateAsync({
      id: editValueTarget.id,
      patch: { label: editValueLabel.trim(), icon: editValueIcon },
    });
    setEditValueTarget(null);
  }

  function openRename(variable: VariableWithValues) {
    setRenameTarget(variable);
    setRenameLabel(variable.label);
    setRenameIcon(variable.icon ?? null);
  }

  async function handleSaveRename() {
    if (!renameTarget || !renameLabel.trim()) return;
    await mutations.updateVariable.mutateAsync({
      id: renameTarget.id,
      patch: { label: renameLabel.trim(), icon: renameIcon },
    });
    setRenameTarget(null);
  }

  async function handleAddCustomResult() {
    if (!resultLabel.trim()) return;
    await customResults.create.mutateAsync({ label: resultLabel.trim(), mapsTo: resultMapsTo, icon: resultIcon });
    setAddResultOpen(false);
    setResultLabel("");
    setResultIcon(null);
    setResultMapsTo("win");
  }

  function handleAddThreshold() {
    const n = Number(newThreshold);
    if (!n || n <= 0) return;
    streaks.add.mutate({ threshold: n, beBreaksStreak: !!(settings?.streak_be_breaks_streak ?? 1) });
    setNewThreshold("");
  }

  const textVarCount = variables.filter((v) => v.type === "text").length;
  const numberVarCount = variables.filter((v) => v.type === "number").length;

  async function handleClearAll() {
    await mutations.clearAll.mutateAsync();
    setClearOpen(false);
  }

  function openApplyTemplate() {
    setApplyOpen(true);
    setApplyStep("select");
    setSelectedTemplateId(templates.options[0]?.id ?? "");
    setMapping({});
  }

  const selectedTemplate: TemplateOption | undefined = templates.options.find((t) => t.id === selectedTemplateId);

  function proceedFromSelect() {
    if (!selectedTemplate) return;
    if (variables.length === 0) {
      void handleApplyConfirm(selectedTemplate, {});
      return;
    }
    const initialMapping: TemplateMapping = {};
    for (const v of variables) {
      const match = selectedTemplate.data.variables.find((tv) => tv.label.toLowerCase() === v.label.toLowerCase());
      initialMapping[v.id] = match ? match.key : null;
    }
    setMapping(initialMapping);
    setApplyStep("map");
  }

  async function handleApplyConfirm(template: TemplateOption, map: TemplateMapping) {
    if (!workspaceId) return;
    setApplying(true);
    try {
      await applyTemplate(workspaceId, template.data, map);
      await queryClient.invalidateQueries({ queryKey: ["variables", workspaceId] });
    } finally {
      setApplying(false);
      setApplyOpen(false);
    }
  }

  const templateSaveCount = variables.reduce((sum, v) => sum + (v.type === "text" ? v.values.length : 1), 0);

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    await templates.create.mutateAsync({
      name: templateName.trim(),
      description: templateDescription.trim() || null,
      data: buildTemplateDataFromVariables(variables),
    });
    setSaveTemplateOpen(false);
    setTemplateName("");
    setTemplateDescription("");
  }

  function renderCard(key: string) {
    if (key === "days_of_week") return <DaysOfWeekCard key={key} />;
    if (key === "time_of_day") return <TimeOfDayCard key={key} trades={trades} customResults={customResults.data ?? []} settings={settings} />;
    if (key === "months") return <MonthsCard key={key} />;
    if (key === "custom_results")
      return <CustomResultsCard key={key} results={customResults.data ?? []} onAdd={() => setAddResultOpen(true)} onRemove={(id) => customResults.remove.mutate(id)} />;
    if (key === "markets")
      return (
        <MarketsCard
          key={key}
          markets={markets.data ?? []}
          adding={addingMarket}
          onToggleAdd={() => setAddingMarket((s) => !s)}
          value={newMarket}
          onChange={setNewMarket}
          onSubmit={() => {
            if (!newMarket.trim()) return;
            markets.create.mutate(newMarket.trim().toUpperCase());
            setNewMarket("");
            setAddingMarket(false);
          }}
          onRemove={(id) => markets.remove.mutate(id)}
        />
      );
    if (key === "streak_analysis")
      return (
        <StreakAnalysisCard
          key={key}
          enabled={!!settings?.streak_analysis_enabled}
          onToggleEnabled={(v) => updateSettings.mutate({ streak_analysis_enabled: v ? 1 : 0 })}
          thresholds={streaks.data ?? []}
          onRemoveThreshold={(id) => streaks.remove.mutate(id)}
          newThreshold={newThreshold}
          onNewThresholdChange={setNewThreshold}
          onAddThreshold={handleAddThreshold}
          beBreaksStreak={!!(settings?.streak_be_breaks_streak ?? 1)}
          onToggleBeBreaksStreak={(v) => updateSettings.mutate({ streak_be_breaks_streak: v ? 1 : 0 })}
        />
      );
    if (key === "accounts")
      return (
        <AccountsCard
          key={key}
          enabled={!!settings?.accounts_enabled}
          onToggleEnabled={(v) => updateSettings.mutate({ accounts_enabled: v ? 1 : 0 })}
          accounts={accounts.data ?? []}
          adding={addingAccount}
          onToggleAdd={() => setAddingAccount((s) => !s)}
          value={newAccount}
          onChange={setNewAccount}
          onSubmit={() => {
            if (!newAccount.trim()) return;
            accounts.create.mutate(newAccount.trim());
            setNewAccount("");
            setAddingAccount(false);
          }}
          onRemove={(id) => accounts.remove.mutate(id)}
        />
      );
    const variable = variables.find((v) => v.id === key);
    if (!variable) return null;
    return (
      <CustomVariableCard
        key={key}
        variable={variable}
        onRename={openRename}
        onDelete={(id) => mutations.deleteVariable.mutate(id)}
        onAddValue={openAddValue}
        onEditValue={openEditValue}
        onDeleteValue={(id) => mutations.deleteValue.mutate(id)}
        onReorderValues={(ids) => mutations.reorderVariableValues.mutate(ids)}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Variables – {workspaceName}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Drag to reorder variables and their values</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={openApplyTemplate}>
          Apply Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSaveTemplateOpen(true)}>
          Save as Template
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
          onClick={() => setClearOpen(true)}
        >
          Clear Variables
        </Button>
        <div className="flex-1" />
        <Button size="sm" data-tour="new-variable-button" onClick={() => setNewVarOpen(true)}>
          <Plus className="h-4 w-4" /> New Variable
        </Button>
      </div>

      <DndContext sensors={cardSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
        <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="variables-grid">
            {cardOrder.map(renderCard)}
          </div>
        </SortableContext>
      </DndContext>

      {/* Create New Variable */}
      <Dialog open={newVarOpen} onOpenChange={setNewVarOpen}>
        <DialogContent data-tour="new-variable-dialog" onInteractOutside={ignoreTourOutsideClicks}>
          <DialogHeader>
            <DialogTitle>New Variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Variable Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["text", "number"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewVarType(t)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors",
                      newVarType === t
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] hover:bg-[var(--color-background)]",
                    )}
                  >
                    <span className="text-2xl font-semibold text-[var(--color-text)]">{t === "text" ? "T" : "#"}</span>
                    <span className="text-sm font-medium text-[var(--color-text)]">{t === "text" ? "Text" : "Number"}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t === "text" ? "Select from options" : "Enter numeric values"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newVarLabel} onChange={(e) => setNewVarLabel(e.target.value)} placeholder="e.g., Setup" />
            </div>
            {newVarType === "text" && (
              <div className="space-y-1.5">
                <Label>First Value</Label>
                <Input
                  value={newVarFirstValue}
                  onChange={(e) => setNewVarFirstValue(e.target.value)}
                  placeholder="e.g., ICT Silver Bullet"
                />
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

      {/* Add value to a variable */}
      <Dialog open={!!addValueTarget} onOpenChange={(o) => !o && setAddValueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to {addValueTarget?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input
              value={newValueLabel}
              onChange={(e) => setNewValueLabel(e.target.value)}
              placeholder="Enter value"
              onKeyDown={(e) => e.key === "Enter" && handleAddValue()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddValueTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddValue}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit a value */}
      <Dialog open={!!editValueTarget} onOpenChange={(o) => !o && setEditValueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconPicker value={editValueIcon} onChange={setEditValueIcon}>
                <IconPickerSwatch icon={editValueIcon} size={56} hint="Click to change icon" />
              </IconPicker>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={editValueLabel} onChange={(e) => setEditValueLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditValueTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveValue}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename a variable */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconPicker value={renameIcon} onChange={setRenameIcon}>
                <IconPickerSwatch icon={renameIcon} size={56} hint="Click to change icon" />
              </IconPicker>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRename}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Result */}
      <Dialog open={addResultOpen} onOpenChange={setAddResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconPicker value={resultIcon} onChange={setResultIcon}>
                <IconPickerSwatch icon={resultIcon} size={56} />
              </IconPicker>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={resultLabel} onChange={(e) => setResultLabel(e.target.value)} placeholder="e.g., Missed Trade" />
            </div>
            <div className="space-y-1.5">
              <Label>Count as (for calculations)</Label>
              <Select value={resultMapsTo} onValueChange={(v) => setResultMapsTo(v as "win" | "loss" | "be")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="be">Break Even</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--color-text-muted)]">
                This result will be counted as a{" "}
                {resultMapsTo === "win" ? "win" : resultMapsTo === "loss" ? "loss" : "break-even"} in all calculations.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddResultOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomResult}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Variables */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Variables?</DialogTitle>
            <DialogDescription>
              This will permanently delete all variables ({textVarCount} text, {numberVarCount} number) from "
              {workspaceName}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearAll}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
            {applyStep === "select" && (
              <DialogDescription>
                Select a template to apply. You'll be able to map your current variables to the new template to
                preserve trade connections.
              </DialogDescription>
            )}
            {applyStep === "map" && (
              <DialogDescription>
                Map each of your current variables to a variable in "{selectedTemplate?.name}", or leave it unmapped
                to remove it.
              </DialogDescription>
            )}
          </DialogHeader>

          {applyStep === "select" && (
            <>
              <div className="space-y-1.5">
                <Label>Select a template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.options.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApplyOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={proceedFromSelect} disabled={!selectedTemplate}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {applyStep === "map" && selectedTemplate && (
            <>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {variables.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-sm">{v.icon} {v.label}</span>
                    <Select
                      value={mapping[v.id] ?? "__skip__"}
                      onValueChange={(val) => setMapping((m) => ({ ...m, [v.id]: val === "__skip__" ? null : val }))}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">Don't map (remove)</SelectItem>
                        {selectedTemplate.data.variables.map((tv) => (
                          <SelectItem key={tv.key} value={tv.key}>
                            {tv.icon} {tv.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApplyStep("select")}>
                  Back
                </Button>
                <Button disabled={applying} onClick={() => handleApplyConfirm(selectedTemplate, mapping)}>
                  Apply Template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Save as Template */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>Save your current variables as a reusable template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-muted)]">
              This will save {templateSaveCount} variables from the current stat.
            </p>
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="My Trading Setup" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Description of this template"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DaysOfWeekCard() {
  const { setNodeRef, style, handleProps } = useCardDnd("days_of_week");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center gap-1.5 space-y-0">
        <DragHandle handleProps={handleProps} />
        <CardTitle className="text-[var(--color-text)]">Days of Week</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {DAY_LABELS.map((d) => (
          <Badge key={d} variant="outline">
            {d}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function MonthsCard() {
  const { setNodeRef, style, handleProps } = useCardDnd("months");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center gap-1.5 space-y-0">
        <DragHandle handleProps={handleProps} />
        <CardTitle className="text-[var(--color-text)]">Months</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {MONTH_LABELS.map((m) => (
          <Badge key={m} variant="outline">
            {m}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function TimeOfDayCard({
  trades,
  customResults,
  settings,
}: {
  trades: Trade[];
  customResults: CustomResult[];
  settings: Settings | undefined;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd("time_of_day");
  const [windowMinutes, setWindowMinutes] = useState<30 | 60 | 120>(60);
  const [calculateBy, setCalculateBy] = useState<"start" | "end" | "active">("start");
  const [fromHour, setFromHour] = useState(9);
  const [toHour, setToHour] = useState(24);

  const calcMode = settings?.calc_mode ?? "r";
  const fmt = (r: number) => formatR(r, calcMode, settings?.risk_per_r_percent, settings?.risk_per_r_dollar, { showSign: true });

  const buckets = useMemo(() => {
    if (fromHour >= toHour) return [];
    return timeOfDayBuckets(trades, { windowMinutes, calculateBy, rangeStartHour: fromHour, rangeEndHour: toHour }, customResults);
  }, [trades, windowMinutes, calculateBy, fromHour, toHour, customResults]);

  const rangeLabel = (idx: number) => {
    const fmtHM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const start = fromHour * 60 + idx * windowMinutes;
    return `${fmtHM(start)}-${fmtHM(start + windowMinutes)}`;
  };

  const nonEmpty = buckets.filter((b) => b.tradeCount > 0);
  const hasEnoughData = trades.length >= 5 && nonEmpty.length > 0;
  const best = [...nonEmpty].sort((a, b) => b.winRatePct - a.winRatePct).slice(0, 3);
  const worst = [...nonEmpty]
    .sort((a, b) => a.winRatePct - b.winRatePct)
    .filter((b) => !best.includes(b))
    .slice(0, 3);

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center gap-1.5 space-y-0">
        <DragHandle handleProps={handleProps} />
        <CardTitle className="text-[var(--color-text)]">Time of Day</CardTitle>
        <Badge variant="outline" className="text-[10px]">
          Auto-generated
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Window</Label>
          <Select value={String(windowMinutes)} onValueChange={(v) => setWindowMinutes(Number(v) as 30 | 60 | 120)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Calculate by</Label>
          <div className="inline-flex rounded-md border border-[var(--color-border)] p-0.5">
            {(["start", "end", "active"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCalculateBy(opt)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs capitalize transition-colors",
                  calculateBy === opt
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-[var(--color-text-muted)]">Time Range</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-[var(--color-text-muted)]" />
              </TooltipTrigger>
              <TooltipContent>
                Trades are bucketed by their {calculateBy} time, in {windowMinutes}-minute windows, within this hour
                range.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={String(fromHour)} onValueChange={(v) => setFromHour(Number(v))}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.filter((h) => h.value < 24).map((h) => (
                  <SelectItem key={h.value} value={String(h.value)}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-[var(--color-text-muted)]">to</span>
            <Select value={String(toHour)} onValueChange={(v) => setToHour(Number(v))}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.filter((h) => h.value > 0).map((h) => (
                  <SelectItem key={h.value} value={String(h.value)}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasEnoughData ? (
          <div className="space-y-3 pt-1">
            {best.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-success)]">Best Performing</p>
                <div className="space-y-1">
                  {best.map((b) => (
                    <div key={b.valueId} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text)]">{rangeLabel(Number(b.valueId))}</span>
                      <span className="tabular-nums text-[var(--color-text-muted)]">
                        {formatPct(b.winRatePct)} WR · {fmt(b.avgR)} · {b.tradeCount} trades
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {worst.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-danger)]">Needs Improvement</p>
                <div className="space-y-1">
                  {worst.map((b) => (
                    <div key={b.valueId} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text)]">{rangeLabel(Number(b.valueId))}</span>
                      <span className="tabular-nums text-[var(--color-text-muted)]">
                        {formatPct(b.winRatePct)} WR · {fmt(b.avgR)} · {b.tradeCount} trades
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="pt-1 text-sm text-[var(--color-text-muted)]">Add trades to see time-based performance insights.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CustomResultsCard({
  results,
  onAdd,
  onRemove,
}: {
  results: { id: string; label: string; maps_to: "win" | "loss" | "be"; icon: string | null }[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd("custom_results");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <DragHandle handleProps={handleProps} />
          <CardTitle className="text-[var(--color-text)]">Custom Results</CardTitle>
        </div>
        <button type="button" onClick={onAdd} className={iconBtn}>
          <Plus className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <Badge variant="win">
          Win <span className="ml-1 text-[9px] opacity-60">Default</span>
        </Badge>
        <Badge variant="loss">
          Loss <span className="ml-1 text-[9px] opacity-60">Default</span>
        </Badge>
        <Badge variant="be">
          Break Even <span className="ml-1 text-[9px] opacity-60">Default</span>
        </Badge>
        {results.map((c) => (
          <Badge key={c.id} variant={c.maps_to} className="gap-1">
            {c.icon} {c.label}
            <button type="button" onClick={() => onRemove(c.id)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function MarketsCard({
  markets,
  adding,
  onToggleAdd,
  value,
  onChange,
  onSubmit,
  onRemove,
}: {
  markets: { id: string; symbol: string }[];
  adding: boolean;
  onToggleAdd: () => void;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd("markets");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <DragHandle handleProps={handleProps} />
          <CardTitle className="text-[var(--color-text)]">Markets</CardTitle>
        </div>
        <button type="button" onClick={onToggleAdd} className={iconBtn}>
          <Plus className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2">
        {markets.length === 0 && !adding ? (
          <p className="text-sm text-[var(--color-text-muted)]">No markets yet. Click + to add one.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {markets.map((m) => (
              <Badge key={m.id} variant="outline" className="gap-1">
                {m.symbol}
                <button type="button" onClick={() => onRemove(m.id)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {adding && (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              placeholder="e.g. EURUSD"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              className="h-8"
            />
            <Button size="icon" variant="secondary" onClick={onSubmit}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StreakAnalysisCard({
  enabled,
  onToggleEnabled,
  thresholds,
  onRemoveThreshold,
  newThreshold,
  onNewThresholdChange,
  onAddThreshold,
  beBreaksStreak,
  onToggleBeBreaksStreak,
}: {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  thresholds: { id: string; threshold: number }[];
  onRemoveThreshold: (id: string) => void;
  newThreshold: string;
  onNewThresholdChange: (v: string) => void;
  onAddThreshold: () => void;
  beBreaksStreak: boolean;
  onToggleBeBreaksStreak: (v: boolean) => void;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd("streak_analysis");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <DragHandle handleProps={handleProps} />
          <CardTitle className="text-[var(--color-text)]">Streak Analysis</CardTitle>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggleEnabled} />
      </CardHeader>
      <CardContent className="space-y-3">
        {!enabled ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Enable to analyze performance after win/loss streaks.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {thresholds.map((s) => (
                <Badge key={s.id} variant="outline" className="gap-1">
                  {s.threshold}+
                  <button type="button" onClick={() => onRemoveThreshold(s.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="e.g. 4"
                value={newThreshold}
                onChange={(e) => onNewThresholdChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddThreshold()}
                className="h-8"
              />
              <Button variant="secondary" size="sm" onClick={onAddThreshold}>
                <Plus className="h-3.5 w-3.5" /> Add threshold
              </Button>
            </div>
            <Separator />
            <label className="flex items-start gap-2">
              <Switch checked={beBreaksStreak} onCheckedChange={onToggleBeBreaksStreak} className="mt-0.5" />
              <span>
                <span className="block text-xs font-medium text-[var(--color-text)]">Break-evens break streaks</span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  When off, BE trades won't reset your win/loss streak count.
                </span>
              </span>
            </label>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AccountsCard({
  enabled,
  onToggleEnabled,
  accounts,
  adding,
  onToggleAdd,
  value,
  onChange,
  onSubmit,
  onRemove,
}: {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;
  accounts: { id: string; name: string }[];
  adding: boolean;
  onToggleAdd: () => void;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd("accounts");
  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <DragHandle handleProps={handleProps} />
          <CardTitle className="text-[var(--color-text)]">Accounts</CardTitle>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggleEnabled} />
      </CardHeader>
      <CardContent className="space-y-2">
        {!enabled ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Enable to tag trades with different accounts (e.g., Funded, Personal).
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => (
                <Badge key={a.id} variant="outline" className="gap-1">
                  {a.name}
                  <button type="button" onClick={() => onRemove(a.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {accounts.length === 0 && !adding && (
                <span className="text-sm text-[var(--color-text-muted)]">No accounts yet.</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {adding ? (
                <>
                  <Input
                    autoFocus
                    placeholder="e.g. Funded #1"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSubmit()}
                    className="h-8"
                  />
                  <Button size="icon" variant="secondary" onClick={onSubmit}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={onToggleAdd}>
                  <Plus className="h-3.5 w-3.5" /> Add Account
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CustomVariableCard({
  variable,
  onRename,
  onDelete,
  onAddValue,
  onEditValue,
  onDeleteValue,
  onReorderValues,
}: {
  variable: VariableWithValues;
  onRename: (v: VariableWithValues) => void;
  onDelete: (id: string) => void;
  onAddValue: (v: VariableWithValues) => void;
  onEditValue: (v: VariableValue) => void;
  onDeleteValue: (id: string) => void;
  onReorderValues: (ids: string[]) => void;
}) {
  const { setNodeRef, style, handleProps } = useCardDnd(variable.id);
  const valueSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleValueDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = variable.values.map((v) => v.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderValues(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <DragHandle handleProps={handleProps} />
          <CardTitle className="flex items-center gap-1.5 truncate text-[var(--color-text)]">
            {variable.icon} {variable.label}
          </CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => onRename(variable)} className={iconBtn}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(variable.id)} className={iconBtnDanger}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {variable.type === "text" && (
            <button type="button" onClick={() => onAddValue(variable)} className={iconBtn}>
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {variable.type === "text" ? (
          variable.values.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No values yet. Click + to add one.</p>
          ) : (
            <DndContext sensors={valueSensors} collisionDetection={closestCenter} onDragEnd={handleValueDragEnd}>
              <SortableContext items={variable.values.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {variable.values.map((val) => (
                    <SortableValueRow
                      key={val.id}
                      value={val}
                      onEdit={() => onEditValue(val)}
                      onDelete={() => onDeleteValue(val.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            Numeric variable — enter a value per trade in the Journal form.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SortableValueRow({
  value,
  onEdit,
  onDelete,
}: {
  value: VariableValue;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {value.icon && <span className="text-sm">{value.icon}</span>}
      <span className="flex-1 truncate text-sm">{value.label}</span>
      <button type="button" onClick={onEdit} className={iconBtn}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDelete} className={iconBtnDanger}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
