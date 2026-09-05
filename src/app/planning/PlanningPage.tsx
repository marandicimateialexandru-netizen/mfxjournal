import { useMemo, useState } from "react";
import { format, differenceInCalendarDays, startOfWeek, isWithinInterval, endOfWeek } from "date-fns";
import { Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatTile } from "@/components/shared/StatTile";
import { usePlanningEntries, usePlanningMutations, useTasks } from "@/features/planning/usePlanning";
import { MindsetCoachPanel } from "@/features/planning/MindsetCoachPanel";
import type { Period } from "@/db/types";

const MOODS = [
  { value: 1, emoji: "😢", label: "Very Bad" },
  { value: 2, emoji: "😕", label: "Bad" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export default function PlanningPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const { data: entries = [] } = usePlanningEntries();
  const { createEntry, deleteEntry } = usePlanningMutations();
  const tasks = useTasks(period);
  const [coachOpen, setCoachOpen] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [journalText, setJournalText] = useState("");
  const [newTask, setNewTask] = useState("");

  const streak = useMemo(() => {
    const sortedDates = [...new Set(entries.map((e) => e.date_start.slice(0, 10)))].sort().reverse();
    let count = 0;
    let cursor = new Date();
    for (const d of sortedDates) {
      const diff = differenceInCalendarDays(cursor, new Date(d));
      if (diff > 1) break;
      count += 1;
      cursor = new Date(d);
    }
    return count;
  }, [entries]);

  const thisWeekCount = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());
    return entries.filter((e) => isWithinInterval(new Date(e.date_start), { start, end })).length;
  }, [entries]);

  const avgMood = useMemo(() => {
    const withMood = entries.filter((e) => e.mood != null);
    if (withMood.length === 0) return null;
    return withMood.reduce((sum, e) => sum + (e.mood ?? 0), 0) / withMood.length;
  }, [entries]);

  async function handleCreateEntry() {
    await createEntry.mutateAsync({
      period,
      date_start: new Date(date).toISOString(),
      title: title || undefined,
      mood: mood ?? undefined,
      energy,
      confidence,
      journal_text: journalText || undefined,
    });
    setTitle("");
    setMood(null);
    setJournalText("");
  }

  const periodEntries = entries.filter((e) => e.period === period);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Planning</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Track your mindset, plans, and reflections</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCoachOpen(true)}>
          <Sparkles className="h-4 w-4" /> AI Coach
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
        <StatTile label="This Week" value={`${thisWeekCount}/7`} />
        <StatTile label="Avg Mood" value={avgMood != null ? MOODS[Math.round(avgMood) - 1]?.emoji ?? "—" : "—"} />
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
                  <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-[var(--color-text-muted)]">Mood</p>
                  <div className="flex gap-2">
                    {MOODS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setMood(m.value)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                          mood === m.value ? "border-[var(--color-primary)] bg-[var(--color-background)]" : "border-transparent"
                        }`}
                        title={m.label}
                      >
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs text-[var(--color-text-muted)]">Energy ({energy}/5)</p>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={energy}
                      onChange={(e) => setEnergy(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[var(--color-text-muted)]">Confidence ({confidence}/5)</p>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <Textarea
                  rows={4}
                  placeholder="What's on your mind?"
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                />
                <Button onClick={handleCreateEntry} className="w-full">
                  Create Entry
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium">Tasks</p>
                <div className="mb-2 flex gap-2">
                  <Input
                    placeholder="Add a task…"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTask.trim()) {
                        tasks.createTask.mutate({ period, date: new Date(date).toISOString(), label: newTask });
                        setNewTask("");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  {(tasks.data ?? []).map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={!!t.done}
                        onCheckedChange={(v) => tasks.toggleTask.mutate({ id: t.id, done: !!v })}
                      />
                      <span className={t.done ? "flex-1 text-[var(--color-text-muted)] line-through" : "flex-1"}>
                        {t.label}
                      </span>
                      <button onClick={() => tasks.deleteTask.mutate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      </button>
                    </div>
                  ))}
                  {(tasks.data ?? []).length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)]">No tasks yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">All Entries ({periodEntries.length})</p>
            {periodEntries.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">No {period} entries yet.</p>
            )}
            {periodEntries.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">
                      {e.title || format(new Date(e.date_start), "PP")}{" "}
                      {e.mood && <span>{MOODS[e.mood - 1]?.emoji}</span>}
                    </div>
                    {e.journal_text && (
                      <div className="text-xs text-[var(--color-text-muted)] line-clamp-1">{e.journal_text}</div>
                    )}
                  </div>
                  <button onClick={() => deleteEntry.mutate(e.id)}>
                    <Trash2 className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {coachOpen && <MindsetCoachPanel onClose={() => setCoachOpen(false)} />}
    </div>
  );
}
