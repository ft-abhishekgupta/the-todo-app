"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
  Select,
  SelectItem,
  Tooltip,
} from "@nextui-org/react";
import {
  Plus,
  Trash2,
  Pencil,
  LineChart,
  Activity,
  Save,
  X,
  CheckCircle2,
  Flame,
  Clock,
  Calendar,
  Maximize2,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import {
  useTrackers,
  useTrackerEntries,
  useTrackerMutations,
} from "@/hooks/use-trackers";
import { useTasks } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs } from "@/hooks/use-habits";
import { useProjects } from "@/hooks/use-projects";
import { usePomodoroSessionsRange } from "@/hooks/use-pomodoro";
import { useSchedule } from "@/hooks/use-schedule";
import {
  Tracker,
  TrackerEntry,
  TrackerField,
  TrackerFilters,
  TrackerFrequency,
  TrackerSource,
  PomodoroTrackerMetric,
  ScheduleTrackerMetric,
  ScheduleEventType,
  HabitCategory,
  TaskCategory,
  TaskSubtype,
  Habit,
  Project,
  PomodoroSession,
  ScheduleEvent,
  Task,
} from "@/types";
import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  isWithinInterval,
  parseISO,
  getISOWeek,
  getISOWeekYear,
} from "date-fns";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const FREQUENCY_OPTIONS: { key: TrackerFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const SOURCE_OPTIONS: { key: TrackerSource; label: string }[] = [
  { key: "manual", label: "Manual entry" },
  { key: "habits_completed", label: "Auto: Habits completed" },
  { key: "tasks_completed", label: "Auto: Tasks completed" },
  { key: "pomodoro", label: "Auto: Pomodoro" },
  { key: "schedule", label: "Auto: Schedule" },
];

const COLOR_OPTIONS = ["primary", "success", "warning", "secondary", "danger", "default"];

const HABIT_CATEGORY_OPTIONS: { key: HabitCategory; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "all_day", label: "All Day" },
  { key: "night", label: "Night" },
  { key: "weekend", label: "Weekend" },
  { key: "month_end", label: "Month End" },
  { key: "quarter_end", label: "Quarter End" },
];

const TASK_CATEGORY_OPTIONS: { key: TaskCategory; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "growth", label: "Growth" },
  { key: "habit", label: "Habit" },
];

const TASK_SUBTYPE_OPTIONS: { key: TaskSubtype; label: string }[] = [
  { key: "project_task", label: "Project task" },
  { key: "general_task", label: "General task" },
  { key: "chores", label: "Chores" },
  { key: "social", label: "Social" },
  { key: "professional_learning", label: "Professional learning" },
  { key: "personal_learning", label: "Personal learning" },
  { key: "improvement", label: "Improvement" },
];

const POMODORO_METRIC_OPTIONS: { key: PomodoroTrackerMetric; label: string }[] = [
  { key: "sessions", label: "Completed focus sessions" },
  { key: "focus_minutes", label: "Focus minutes" },
];

const SCHEDULE_EVENT_TYPE_OPTIONS: { key: ScheduleEventType; label: string }[] = [
  { key: "event", label: "Event" },
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "growth", label: "Growth" },
  { key: "task", label: "Task" },
  { key: "habit", label: "Habit" },
];

const SCHEDULE_METRIC_OPTIONS: { key: ScheduleTrackerMetric; label: string }[] = [
  { key: "minutes", label: "Total minutes" },
  { key: "hours", label: "Total hours" },
  { key: "count", label: "Number of events" },
];

// --------------------------------------------------------------------------
// Period helpers
// --------------------------------------------------------------------------

function periodKey(d: Date, freq: TrackerFrequency): string {
  if (freq === "daily") return format(d, "yyyy-MM-dd");
  if (freq === "weekly") {
    return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
  }
  return format(d, "yyyy-MM");
}

function periodLabel(key: string, freq: TrackerFrequency): string {
  if (freq === "daily") {
    try {
      return format(parseISO(key), "MMM d");
    } catch {
      return key;
    }
  }
  if (freq === "weekly") {
    const m = key.match(/^(\d{4})-W(\d{2})$/);
    return m ? `W${m[2]}` : key;
  }
  try {
    return format(parseISO(`${key}-01`), "MMM yy");
  } catch {
    return key;
  }
}

function periodLabelLong(key: string, freq: TrackerFrequency): string {
  if (freq === "daily") {
    try {
      return format(parseISO(key), "MMM d, yyyy");
    } catch {
      return key;
    }
  }
  if (freq === "weekly") {
    const m = key.match(/^(\d{4})-W(\d{2})$/);
    return m ? `Week ${m[2]}, ${m[1]}` : key;
  }
  try {
    return format(parseISO(`${key}-01`), "MMMM yyyy");
  } catch {
    return key;
  }
}

function periodRange(d: Date, freq: TrackerFrequency): { start: Date; end: Date } {
  if (freq === "daily") {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (freq === "weekly") {
    return { start: startOfISOWeek(d), end: endOfISOWeek(d) };
  }
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

function lastNPeriods(freq: TrackerFrequency, n: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    if (freq === "daily") out.push(subDays(today, i));
    else if (freq === "weekly") out.push(subWeeks(today, i));
    else out.push(subMonths(today, i));
  }
  return out;
}

// --------------------------------------------------------------------------
// Auto value computation
// --------------------------------------------------------------------------

function computeAutoValue(
  tracker: Tracker,
  periodDate: Date,
  ctx: {
    tasks: Task[];
    habits: Habit[];
    habitLogs: any[];
    pomodoroSessions: PomodoroSession[];
    scheduleEvents: ScheduleEvent[];
  }
): number {
  const { start, end } = periodRange(periodDate, tracker.frequency);
  const f = tracker.filters || {};

  if (tracker.source === "habits_completed") {
    const startKey = format(start, "yyyy-MM-dd");
    const endKey = format(end, "yyyy-MM-dd");
    const habitById = new Map(ctx.habits.map((h) => [h.id, h]));
    return ctx.habitLogs.filter((l: any) => {
      if (!l.completed) return false;
      if (l.date < startKey || l.date > endKey) return false;
      if (f.habitIds && f.habitIds.length > 0 && !f.habitIds.includes(l.habitId)) return false;
      if (f.habitCategories && f.habitCategories.length > 0) {
        const h = habitById.get(l.habitId);
        if (!h || !f.habitCategories.includes(h.category)) return false;
      }
      return true;
    }).length;
  }

  if (tracker.source === "tasks_completed") {
    return ctx.tasks.filter((t: any) => {
      if (t.status !== "completed") return false;
      const ref = t.updatedAt?.toDate?.() || t.scheduledDate?.toDate?.();
      if (!ref || !isWithinInterval(ref, { start, end })) return false;
      if (f.taskCategories && f.taskCategories.length > 0 && !f.taskCategories.includes(t.category))
        return false;
      if (f.taskSubtypes && f.taskSubtypes.length > 0 && (!t.subtype || !f.taskSubtypes.includes(t.subtype)))
        return false;
      if (f.projectIds && f.projectIds.length > 0 && (!t.projectId || !f.projectIds.includes(t.projectId)))
        return false;
      return true;
    }).length;
  }

  if (tracker.source === "pomodoro") {
    const metric = f.pomodoroMetric || "sessions";
    const inRange = ctx.pomodoroSessions.filter((s: any) => {
      const ref = s.startedAt?.toDate?.();
      if (!ref || !isWithinInterval(ref, { start, end })) return false;
      // Only completed focus sessions count
      if (s.mode && s.mode !== "focus") return false;
      if (!s.isCompleted) return false;
      return true;
    });
    if (metric === "focus_minutes") {
      return Math.round(
        inRange.reduce(
          (sum: number, s: any) =>
            sum + (s.actualDurationSeconds ? s.actualDurationSeconds / 60 : s.duration || 0),
          0
        )
      );
    }
    return inRange.length;
  }

  if (tracker.source === "schedule") {
    const metric = f.scheduleMetric || "minutes";
    const startKey = format(start, "yyyy-MM-dd");
    const endKey = format(end, "yyyy-MM-dd");
    const types = f.scheduleEventTypes;
    const inRange = ctx.scheduleEvents.filter((e) => {
      if (!e.date || e.date < startKey || e.date > endKey) return false;
      if (types && types.length > 0 && !types.includes(e.type)) return false;
      return true;
    });
    if (metric === "count") return inRange.length;
    const totalMin = inRange.reduce((sum, e) => sum + diffMinutes(e.startTime, e.endTime), 0);
    if (metric === "hours") return Math.round((totalMin / 60) * 10) / 10;
    return Math.round(totalMin);
  }

  return 0;
}

function diffMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight
  return mins;
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

export default function TrackerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { trackers, loading: trackersLoading } = useTrackers();
  const { entries } = useTrackerEntries();
  const { addTracker, updateTracker, deleteTracker, upsertEntry, deleteEntry } =
    useTrackerMutations();
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const { logs } = useHabitLogs(undefined, 365);
  const { projects } = useProjects();
  const { sessions: pomodoroSessions } = usePomodoroSessionsRange(365);
  const { events: scheduleEvents } = useSchedule();

  const formModal = useDisclosure();
  const detailModal = useDisclosure();
  const [editing, setEditing] = useState<Tracker | null>(null);
  const [viewing, setViewing] = useState<Tracker | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const entriesByTracker = useMemo(() => {
    const m: Record<string, TrackerEntry[]> = {};
    for (const e of entries) {
      (m[e.trackerId] = m[e.trackerId] || []).push(e);
    }
    return m;
  }, [entries]);

  const ctx = { tasks, habits, habitLogs: logs, pomodoroSessions, scheduleEvents };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    formModal.onOpen();
  };
  const openEdit = (t: Tracker) => {
    setEditing(t);
    formModal.onOpen();
  };
  const openDetail = (t: Tracker) => {
    setViewing(t);
    detailModal.onOpen();
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            <h1 className="text-xl sm:text-2xl font-semibold">Trackers</h1>
            <Chip size="sm" variant="flat">{trackers.length}</Chip>
          </div>
          <Button color="primary" size="sm" startContent={<Plus size={14} />} onPress={openCreate}>
            New tracker
          </Button>
        </div>

        {trackersLoading ? (
          <p className="text-default-400 text-sm">Loading trackers...</p>
        ) : trackers.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center">
              <Activity size={32} className="mx-auto text-default-300 mb-2" />
              <p className="text-default-500 mb-1">No trackers yet</p>
              <p className="text-default-400 text-sm mb-4">
                Track anything: weight, steps, calories, focus minutes, tasks completed,
                habits done...
              </p>
              <Button color="primary" size="sm" startContent={<Plus size={14} />} onPress={openCreate}>
                Create your first tracker
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trackers.map((t) => (
              <TrackerCard
                key={t.id}
                tracker={t}
                entries={entriesByTracker[t.id] || []}
                ctx={ctx}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTracker(t.id)}
                onOpenDetail={() => openDetail(t)}
                onSaveEntry={(periodKey, values, notes) =>
                  upsertEntry(t.id, periodKey, values, notes)
                }
              />
            ))}
          </div>
        )}
      </main>

      <TrackerFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        tracker={editing}
        habits={habits}
        projects={projects}
        onSubmit={async (data) => {
          if (editing) {
            await updateTracker(editing.id, data);
          } else {
            await addTracker(data);
          }
          formModal.onClose();
        }}
      />

      {viewing && (
        <TrackerDetailModal
          isOpen={detailModal.isOpen}
          onClose={() => {
            detailModal.onClose();
            setViewing(null);
          }}
          tracker={viewing}
          entries={entriesByTracker[viewing.id] || []}
          ctx={ctx}
          onSaveEntry={(periodKey, values, notes) =>
            upsertEntry(viewing.id, periodKey, values, notes)
          }
          onDeleteEntry={(id) => deleteEntry(id)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Tracker card
// --------------------------------------------------------------------------

function TrackerCard({
  tracker,
  entries,
  ctx,
  onEdit,
  onDelete,
  onOpenDetail,
  onSaveEntry,
}: {
  tracker: Tracker;
  entries: TrackerEntry[];
  ctx: { tasks: Task[]; habits: Habit[]; habitLogs: any[]; pomodoroSessions: PomodoroSession[]; scheduleEvents: ScheduleEvent[] };
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
  onSaveEntry: (periodKey: string, values: Record<string, number>, notes?: string) => Promise<void>;
}) {
  const today = new Date();
  const currentKey = periodKey(today, tracker.frequency);
  const isAuto = tracker.source !== "manual";

  const entryFor = (key: string) => entries.find((e) => e.periodKey === key);

  const recent = useMemo(() => {
    const periods = lastNPeriods(tracker.frequency, 7).reverse();
    return periods.map((d) => {
      const key = periodKey(d, tracker.frequency);
      let total = 0;
      if (isAuto) {
        total = computeAutoValue(tracker, d, ctx);
      } else {
        const e = entryFor(key);
        for (const f of tracker.fields) total += e?.values?.[f.id] ?? 0;
      }
      return { date: d, key, total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker, entries, isAuto, ctx.tasks, ctx.habits, ctx.habitLogs, ctx.pomodoroSessions, ctx.scheduleEvents]);

  const currentEntry = entryFor(currentKey);
  const currentValues: Record<string, number> = isAuto
    ? { [tracker.fields[0]?.id || "value"]: computeAutoValue(tracker, today, ctx) }
    : Object.fromEntries(
        tracker.fields.map((f) => [f.id, currentEntry?.values?.[f.id] ?? 0])
      );

  const SourceIcon = sourceIcon(tracker.source);
  const maxRecent = Math.max(1, ...recent.map((r) => r.total));

  return (
    <Card shadow="sm" className="h-full">
      <CardHeader className="flex justify-between items-start px-4 pt-3 pb-2">
        <button
          className="flex items-start gap-2 min-w-0 text-left flex-1 group/title"
          onClick={onOpenDetail}
          aria-label="Open tracker details"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-default-100 shrink-0">
            {tracker.icon ? (
              <span className="text-base">{tracker.icon}</span>
            ) : (
              <SourceIcon size={16} className={textColor(tracker.color)} />
            )}
          </div>
          <div className="min-w-0">
            <p
              className="font-semibold text-sm truncate group-hover/title:text-primary transition-colors"
              title={tracker.name}
            >
              {tracker.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Chip size="sm" variant="flat" className="h-4 text-[10px] px-1.5">
                {tracker.frequency}
              </Chip>
              {isAuto && (
                <Chip size="sm" variant="flat" color="secondary" className="h-4 text-[10px] px-1.5">
                  auto
                </Chip>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content="Open" placement="top">
            <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onOpenDetail}>
              <Maximize2 size={12} />
            </Button>
          </Tooltip>
          <Tooltip content="Edit" placement="top">
            <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onEdit}>
              <Pencil size={12} />
            </Button>
          </Tooltip>
          <Tooltip content="Delete" placement="top" color="danger">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              className="w-6 h-6 min-w-6"
              onPress={() => {
                if (confirm(`Delete tracker "${tracker.name}"? Past entries are kept.`)) onDelete();
              }}
            >
              <Trash2 size={12} />
            </Button>
          </Tooltip>
        </div>
      </CardHeader>

      <CardBody className="pt-1 px-4 pb-3">
        <CurrentPeriodEditor
          tracker={tracker}
          currentKey={currentKey}
          currentValues={currentValues}
          notes={currentEntry?.notes}
          isAuto={isAuto}
          onSave={onSaveEntry}
          colorClass={textColor(tracker.color)}
        />

        <div className="mt-3 pt-3 border-t border-default-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-default-400 uppercase">
              Last 7 {tracker.frequency === "daily" ? "days" : tracker.frequency === "weekly" ? "weeks" : "months"}
            </span>
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-[10px] text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="flex items-end gap-1 h-16">
            {recent.map((r) => {
              const h = Math.max(2, (r.total / maxRecent) * 100);
              return (
                <Tooltip
                  key={r.key}
                  content={`${periodLabel(r.key, tracker.frequency)}: ${formatTotal(r.total, tracker)}`}
                  placement="top"
                >
                  <div className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className={`w-full rounded-t ${bgColor(tracker.color)} ${
                        r.total === 0 ? "opacity-20" : "opacity-80"
                      } hover:opacity-100 transition-opacity`}
                      style={{ height: `${h}%`, minHeight: 2 }}
                    />
                    <span className="text-[9px] text-default-400 mt-1 truncate w-full text-center">
                      {periodLabel(r.key, tracker.frequency).split(" ")[0]}
                    </span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function sourceIcon(source: TrackerSource) {
  if (source === "habits_completed") return Flame;
  if (source === "tasks_completed") return CheckCircle2;
  if (source === "pomodoro") return Clock;
  if (source === "schedule") return Calendar;
  return LineChart;
}

function textColor(color?: string) {
  switch (color) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "secondary":
      return "text-secondary";
    case "danger":
      return "text-danger";
    case "default":
      return "text-default-500";
    default:
      return "text-primary";
  }
}

function bgColor(color?: string) {
  switch (color) {
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    case "secondary":
      return "bg-secondary";
    case "danger":
      return "bg-danger";
    case "default":
      return "bg-default-400";
    default:
      return "bg-primary";
  }
}

function formatTotal(value: number, tracker: Tracker): string {
  const unit = tracker.fields.length === 1 ? tracker.fields[0]?.unit : undefined;
  return unit ? `${value} ${unit}` : String(value);
}

// --------------------------------------------------------------------------
// Current period editor
// --------------------------------------------------------------------------

function CurrentPeriodEditor({
  tracker,
  currentKey,
  currentValues,
  notes: notesProp,
  isAuto,
  onSave,
  colorClass,
}: {
  tracker: Tracker;
  currentKey: string;
  currentValues: Record<string, number>;
  notes?: string;
  isAuto: boolean;
  onSave: (key: string, values: Record<string, number>, notes?: string) => Promise<void>;
  colorClass: string;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tracker.fields.map((f) => [f.id, currentValues[f.id] ? String(currentValues[f.id]) : ""])
    )
  );
  const [notes, setNotes] = useState<string>(notesProp || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        tracker.fields.map((f) => [f.id, currentValues[f.id] ? String(currentValues[f.id]) : ""])
      )
    );
    setNotes(notesProp || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, JSON.stringify(currentValues), notesProp]);

  const handleSave = async () => {
    const values: Record<string, number> = {};
    for (const f of tracker.fields) {
      const raw = draft[f.id]?.trim();
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (!Number.isNaN(n)) values[f.id] = n;
    }
    if (Object.keys(values).length === 0) return;
    setSaving(true);
    try {
      await onSave(currentKey, values, notes.trim() || undefined);
    } finally {
      setSaving(false);
    }
  };

  if (isAuto) {
    const f = tracker.fields[0];
    const v = currentValues[f?.id || "value"] ?? 0;
    return (
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-semibold ${colorClass}`}>{v}</span>
        {f?.unit && <span className="text-xs text-default-400">{f.unit}</span>}
        {f?.target ? (
          <span className="text-xs text-default-400 ml-auto">/ {f.target} target</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {tracker.fields.map((f) => (
        <div key={f.id} className="flex items-center gap-1.5">
          <span className="text-xs text-default-500 flex-1 truncate" title={f.label}>
            {f.label}
            {f.target ? (
              <span className="text-default-300 ml-1">/ {f.target}</span>
            ) : null}
          </span>
          <Input
            size="sm"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={draft[f.id] ?? ""}
            onValueChange={(v) => setDraft((d) => ({ ...d, [f.id]: v }))}
            classNames={{ inputWrapper: "h-7", input: "text-xs text-right" }}
            className="w-24"
            endContent={
              f.unit ? <span className="text-[10px] text-default-400">{f.unit}</span> : null
            }
          />
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-1">
        <Input
          size="sm"
          placeholder="Notes (optional)"
          value={notes}
          onValueChange={setNotes}
          classNames={{ inputWrapper: "h-7", input: "text-xs" }}
          className="flex-1"
        />
        <Button
          size="sm"
          color="primary"
          isIconOnly
          className="h-7 w-7 min-w-7"
          isLoading={saving}
          onPress={handleSave}
          aria-label="Save"
        >
          <Save size={12} />
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Detail modal
// --------------------------------------------------------------------------

function TrackerDetailModal({
  isOpen,
  onClose,
  tracker,
  entries,
  ctx,
  onSaveEntry,
  onDeleteEntry,
}: {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker;
  entries: TrackerEntry[];
  ctx: { tasks: Task[]; habits: Habit[]; habitLogs: any[]; pomodoroSessions: PomodoroSession[]; scheduleEvents: ScheduleEvent[] };
  onSaveEntry: (periodKey: string, values: Record<string, number>, notes?: string) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}) {
  const isAuto = tracker.source !== "manual";

  // For auto trackers we synthesize rows for the last 30 periods.
  // For manual trackers we list all stored entries (most recent first).
  const rows = useMemo(() => {
    if (isAuto) {
      const periods = lastNPeriods(tracker.frequency, 30);
      return periods.map((d) => {
        const key = periodKey(d, tracker.frequency);
        const total = computeAutoValue(tracker, d, ctx);
        return {
          key,
          date: d,
          values: { [tracker.fields[0]?.id || "value"]: total } as Record<string, number>,
          notes: undefined as string | undefined,
          entryId: undefined as string | undefined,
          total,
        };
      });
    }
    const sorted = [...entries].sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
    return sorted.map((e) => {
      const total = tracker.fields.reduce((s, f) => s + (e.values?.[f.id] ?? 0), 0);
      return {
        key: e.periodKey,
        date: parsePeriodKey(e.periodKey, tracker.frequency),
        values: e.values || {},
        notes: e.notes,
        entryId: e.id,
        total,
      };
    });
  }, [tracker, entries, ctx, isAuto]);

  const chartRows = isAuto ? rows.slice().reverse() : rows.slice(0, 30).reverse();
  const maxChart = Math.max(1, ...chartRows.map((r) => r.total));

  // Quick-add for manual: choose any past period and enter values.
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState<string>(periodKey(new Date(), tracker.frequency));
  const [addDraft, setAddDraft] = useState<Record<string, string>>({});
  const [addNotes, setAddNotes] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  useEffect(() => {
    if (!adding) return;
    setAddKey(periodKey(new Date(), tracker.frequency));
    setAddDraft({});
    setAddNotes("");
  }, [adding, tracker.frequency]);

  const submitAdd = async () => {
    const values: Record<string, number> = {};
    for (const f of tracker.fields) {
      const raw = addDraft[f.id]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isNaN(n)) values[f.id] = n;
    }
    if (Object.keys(values).length === 0 || !addKey) return;
    setSavingAdd(true);
    try {
      await onSaveEntry(addKey, values, addNotes.trim() || undefined);
      setAdding(false);
    } finally {
      setSavingAdd(false);
    }
  };

  const stats = useMemo(() => {
    const totals = rows.map((r) => r.total).filter((n) => n > 0);
    if (totals.length === 0) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    const sum = totals.reduce((a, b) => a + b, 0);
    return {
      count: totals.length,
      sum,
      avg: Math.round((sum / totals.length) * 100) / 100,
      min: Math.min(...totals),
      max: Math.max(...totals),
    };
  }, [rows]);

  const SourceIcon = sourceIcon(tracker.source);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-default-100 shrink-0">
            {tracker.icon ? (
              <span className="text-xl">{tracker.icon}</span>
            ) : (
              <SourceIcon size={18} className={textColor(tracker.color)} />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{tracker.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Chip size="sm" variant="flat" className="h-5 text-[11px]">
                {tracker.frequency}
              </Chip>
              <Chip size="sm" variant="flat" className="h-5 text-[11px]">
                {labelForSource(tracker.source)}
              </Chip>
              {tracker.fields[0]?.unit && (
                <Chip size="sm" variant="flat" className="h-5 text-[11px]">
                  {tracker.fields[0].unit}
                </Chip>
              )}
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <StatTile label="Periods" value={stats.count} />
            <StatTile label="Average" value={stats.avg} />
            <StatTile label="Best" value={stats.max} />
            <StatTile label="Total" value={stats.sum} />
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-default-100 p-3">
            <p className="text-[10px] font-semibold text-default-400 uppercase mb-2">
              Last 30 {tracker.frequency === "daily" ? "days" : tracker.frequency === "weekly" ? "weeks" : "months"}
            </p>
            <div className="flex items-end gap-0.5 h-32">
              {chartRows.map((r) => {
                const h = Math.max(2, (r.total / maxChart) * 100);
                return (
                  <Tooltip
                    key={r.key}
                    content={`${periodLabelLong(r.key, tracker.frequency)}: ${formatTotal(r.total, tracker)}`}
                    placement="top"
                  >
                    <div className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                      <div
                        className={`w-full rounded-t ${bgColor(tracker.color)} ${
                          r.total === 0 ? "opacity-15" : "opacity-80"
                        } hover:opacity-100 transition-opacity`}
                        style={{ height: `${h}%`, minHeight: 2 }}
                      />
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Add manual entry */}
          {!isAuto && (
            <div className="mt-3">
              {!adding ? (
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus size={14} />}
                  onPress={() => setAdding(true)}
                >
                  Add / edit a period
                </Button>
              ) : (
                <div className="rounded-lg border border-default-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-default-500">Period key</span>
                    <Input
                      size="sm"
                      value={addKey}
                      onValueChange={setAddKey}
                      placeholder={periodKey(new Date(), tracker.frequency)}
                      description={
                        tracker.frequency === "daily"
                          ? "YYYY-MM-DD"
                          : tracker.frequency === "weekly"
                          ? "YYYY-Www (e.g. 2026-W19)"
                          : "YYYY-MM"
                      }
                      classNames={{ inputWrapper: "h-7" }}
                      className="max-w-[200px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tracker.fields.map((f) => (
                      <Input
                        key={f.id}
                        size="sm"
                        type="number"
                        label={f.label + (f.unit ? ` (${f.unit})` : "")}
                        value={addDraft[f.id] ?? ""}
                        onValueChange={(v) => setAddDraft((d) => ({ ...d, [f.id]: v }))}
                      />
                    ))}
                  </div>
                  <Input
                    size="sm"
                    placeholder="Notes (optional)"
                    value={addNotes}
                    onValueChange={setAddNotes}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="light" onPress={() => setAdding(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" color="primary" isLoading={savingAdd} onPress={submitAdd}>
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History table */}
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-default-400 uppercase mb-1">History</p>
            <div className="rounded-lg border border-default-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-default-50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-default-500">Period</th>
                    {tracker.fields.map((f) => (
                      <th key={f.id} className="px-3 py-2 font-medium text-default-500 text-right">
                        {f.label}
                        {f.unit ? <span className="text-default-400"> ({f.unit})</span> : null}
                      </th>
                    ))}
                    {!isAuto && <th className="px-3 py-2 font-medium text-default-500">Notes</th>}
                    {!isAuto && <th className="px-2 py-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={tracker.fields.length + (isAuto ? 1 : 3)} className="px-3 py-6 text-center text-default-400">
                        No entries yet
                      </td>
                    </tr>
                  ) : (
                    rows.slice(0, 60).map((r) => (
                      <tr key={r.key} className="border-t border-default-100">
                        <td className="px-3 py-2 text-default-700">
                          {periodLabelLong(r.key, tracker.frequency)}
                        </td>
                        {tracker.fields.map((f) => (
                          <td key={f.id} className="px-3 py-2 text-right tabular-nums">
                            {r.values[f.id] ?? 0}
                          </td>
                        ))}
                        {!isAuto && (
                          <td className="px-3 py-2 text-default-500 truncate max-w-[200px]" title={r.notes}>
                            {r.notes || "—"}
                          </td>
                        )}
                        {!isAuto && (
                          <td className="px-2 py-2 text-right">
                            {r.entryId && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                className="w-6 h-6 min-w-6"
                                onPress={() => {
                                  if (confirm("Delete this entry?")) onDeleteEntry(r.entryId!);
                                }}
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-default-100 p-2">
      <p className="text-[10px] uppercase text-default-400 font-semibold">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function labelForSource(s: TrackerSource): string {
  return SOURCE_OPTIONS.find((o) => o.key === s)?.label || s;
}

function parsePeriodKey(key: string, freq: TrackerFrequency): Date {
  if (freq === "daily") {
    try {
      return parseISO(key);
    } catch {
      return new Date();
    }
  }
  if (freq === "weekly") {
    const m = key.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return new Date();
    // Approximate: take Monday of given ISO week.
    const jan4 = new Date(Number(m[1]), 0, 4);
    const start = startOfISOWeek(jan4);
    start.setDate(start.getDate() + (Number(m[2]) - 1) * 7);
    return start;
  }
  try {
    return parseISO(`${key}-01`);
  } catch {
    return new Date();
  }
}

// --------------------------------------------------------------------------
// Create / edit modal
// --------------------------------------------------------------------------

function newFieldId() {
  return Math.random().toString(36).slice(2, 9);
}

function TrackerFormModal({
  isOpen,
  onClose,
  tracker,
  habits,
  projects,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker | null;
  habits: Habit[];
  projects: Project[];
  onSubmit: (data: Omit<Tracker, "id" | "userId" | "createdAt" | "updatedAt" | "order" | "isActive">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("primary");
  const [frequency, setFrequency] = useState<TrackerFrequency>("daily");
  const [source, setSource] = useState<TrackerSource>("manual");
  const [fields, setFields] = useState<TrackerField[]>([
    { id: newFieldId(), label: "Value", unit: "", target: undefined },
  ]);
  const [filters, setFilters] = useState<TrackerFilters>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (tracker) {
      setName(tracker.name);
      setIcon(tracker.icon || "");
      setColor(tracker.color || "primary");
      setFrequency(tracker.frequency);
      setSource(tracker.source);
      setFilters(tracker.filters || {});
      setFields(
        tracker.fields.length > 0
          ? tracker.fields.map((f) => ({ ...f }))
          : [{ id: newFieldId(), label: "Value" }]
      );
    } else {
      setName("");
      setIcon("");
      setColor("primary");
      setFrequency("daily");
      setSource("manual");
      setFilters({});
      setFields([{ id: newFieldId(), label: "Value", unit: "" }]);
    }
  }, [isOpen, tracker]);

  const isAuto = source !== "manual";

  const addField = () => setFields((prev) => [...prev, { id: newFieldId(), label: "" }]);
  const removeField = (id: string) =>
    setFields((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));
  const updateField = (id: string, patch: Partial<TrackerField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const finalFields: TrackerField[] = isAuto
      ? [
          (() => {
            const base: TrackerField = {
              id: "value",
              label:
                source === "pomodoro" && filters.pomodoroMetric === "focus_minutes"
                  ? "Minutes"
                  : source === "schedule"
                  ? filters.scheduleMetric === "hours"
                    ? "Hours"
                    : filters.scheduleMetric === "count"
                    ? "Count"
                    : "Minutes"
                  : "Count",
            };
            const unit = fields[0]?.unit?.trim();
            if (unit) base.unit = unit;
            else if (source === "pomodoro" && filters.pomodoroMetric === "focus_minutes") base.unit = "min";
            else if (source === "schedule") {
              if (filters.scheduleMetric === "hours") base.unit = "h";
              else if (!filters.scheduleMetric || filters.scheduleMetric === "minutes") base.unit = "min";
            }
            if (typeof fields[0]?.target === "number" && !Number.isNaN(fields[0]?.target)) {
              base.target = fields[0]!.target;
            }
            return base;
          })(),
        ]
      : fields.map((f) => {
          const base: TrackerField = { id: f.id, label: f.label.trim() || "Value" };
          const unit = f.unit?.trim();
          if (unit) base.unit = unit;
          if (typeof f.target === "number" && !Number.isNaN(f.target)) base.target = f.target;
          if (f.color) base.color = f.color;
          return base;
        });

    // Build the filters payload, omitting empty arrays / undefined.
    const cleanFilters: TrackerFilters = {};
    if (source === "habits_completed") {
      if (filters.habitCategories?.length) cleanFilters.habitCategories = filters.habitCategories;
      if (filters.habitIds?.length) cleanFilters.habitIds = filters.habitIds;
    } else if (source === "tasks_completed") {
      if (filters.taskCategories?.length) cleanFilters.taskCategories = filters.taskCategories;
      if (filters.taskSubtypes?.length) cleanFilters.taskSubtypes = filters.taskSubtypes;
      if (filters.projectIds?.length) cleanFilters.projectIds = filters.projectIds;
    } else if (source === "pomodoro") {
      cleanFilters.pomodoroMetric = filters.pomodoroMetric || "sessions";
    } else if (source === "schedule") {
      cleanFilters.scheduleMetric = filters.scheduleMetric || "minutes";
      if (filters.scheduleEventTypes?.length)
        cleanFilters.scheduleEventTypes = filters.scheduleEventTypes;
    }

    const payload: any = {
      name: trimmed,
      color,
      frequency,
      source,
      fields: finalFields,
    };
    const trimmedIcon = icon.trim();
    if (trimmedIcon) payload.icon = trimmedIcon;
    if (Object.keys(cleanFilters).length > 0) payload.filters = cleanFilters;

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{tracker ? "Edit tracker" : "New tracker"}</ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                label="Name"
                value={name}
                onValueChange={setName}
                placeholder="Weight, Steps, Calories..."
                size="sm"
                isRequired
                className="sm:col-span-2"
              />
              <Input
                label="Icon (emoji)"
                value={icon}
                onValueChange={setIcon}
                placeholder="⚖️"
                size="sm"
                maxLength={4}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                label="Frequency"
                size="sm"
                selectedKeys={[frequency]}
                onSelectionChange={(keys) =>
                  setFrequency(Array.from(keys)[0] as TrackerFrequency)
                }
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Source"
                size="sm"
                selectedKeys={[source]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as TrackerSource;
                  setSource(next);
                  setFilters({});
                }}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Color"
                size="sm"
                selectedKeys={[color]}
                onSelectionChange={(keys) =>
                  setColor(Array.from(keys)[0] as string)
                }
              >
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c} textValue={c}>
                    <span className="capitalize">{c}</span>
                  </SelectItem>
                ))}
              </Select>
            </div>

            {isAuto ? (
              <div className="rounded-lg bg-default-50 p-3 text-xs text-default-600 space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <Activity size={12} />
                  Auto-derived value
                </div>

                {source === "habits_completed" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      label="Habit categories (any)"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(filters.habitCategories || [])}
                      onSelectionChange={(keys) =>
                        setFilters((f) => ({
                          ...f,
                          habitCategories: Array.from(keys) as HabitCategory[],
                        }))
                      }
                    >
                      {HABIT_CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.key}>{o.label}</SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Specific habits (any)"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(filters.habitIds || [])}
                      onSelectionChange={(keys) =>
                        setFilters((f) => ({ ...f, habitIds: Array.from(keys) as string[] }))
                      }
                    >
                      {habits.map((h) => (
                        <SelectItem key={h.id} textValue={h.title}>
                          {h.icon ? `${h.icon} ` : ""}
                          {h.title}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}

                {source === "tasks_completed" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        label="Task categories (any)"
                        size="sm"
                        selectionMode="multiple"
                        selectedKeys={new Set(filters.taskCategories || [])}
                        onSelectionChange={(keys) =>
                          setFilters((f) => ({
                            ...f,
                            taskCategories: Array.from(keys) as TaskCategory[],
                          }))
                        }
                      >
                        {TASK_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.key}>{o.label}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Subtypes (any)"
                        size="sm"
                        selectionMode="multiple"
                        selectedKeys={new Set(filters.taskSubtypes || [])}
                        onSelectionChange={(keys) =>
                          setFilters((f) => ({
                            ...f,
                            taskSubtypes: Array.from(keys) as TaskSubtype[],
                          }))
                        }
                      >
                        {TASK_SUBTYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.key}>{o.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <Select
                      label="Projects (any)"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(filters.projectIds || [])}
                      onSelectionChange={(keys) =>
                        setFilters((f) => ({ ...f, projectIds: Array.from(keys) as string[] }))
                      }
                    >
                      {projects.map((p) => (
                        <SelectItem key={p.id} textValue={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}

                {source === "pomodoro" && (
                  <Select
                    label="Metric"
                    size="sm"
                    selectedKeys={[filters.pomodoroMetric || "sessions"]}
                    onSelectionChange={(keys) =>
                      setFilters((f) => ({
                        ...f,
                        pomodoroMetric: Array.from(keys)[0] as PomodoroTrackerMetric,
                      }))
                    }
                  >
                    {POMODORO_METRIC_OPTIONS.map((o) => (
                      <SelectItem key={o.key}>{o.label}</SelectItem>
                    ))}
                  </Select>
                )}

                {source === "schedule" && (
                  <div className="grid grid-cols-1 gap-2">
                    <Select
                      label="Metric"
                      size="sm"
                      selectedKeys={[filters.scheduleMetric || "minutes"]}
                      onSelectionChange={(keys) =>
                        setFilters((f) => ({
                          ...f,
                          scheduleMetric: Array.from(keys)[0] as ScheduleTrackerMetric,
                        }))
                      }
                    >
                      {SCHEDULE_METRIC_OPTIONS.map((o) => (
                        <SelectItem key={o.key}>{o.label}</SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Event types (leave empty for all)"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(filters.scheduleEventTypes || [])}
                      onSelectionChange={(keys) =>
                        setFilters((f) => ({
                          ...f,
                          scheduleEventTypes: Array.from(keys) as ScheduleEventType[],
                        }))
                      }
                    >
                      {SCHEDULE_EVENT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.key}>{o.label}</SelectItem>
                      ))}
                    </Select>
                  </div>
                )}

                <p className="text-default-500">
                  Counts are computed automatically for the current period. Leave filters empty to
                  count everything.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Unit"
                    size="sm"
                    value={fields[0]?.unit || ""}
                    onValueChange={(v) =>
                      setFields((prev) => [{ ...prev[0], unit: v }, ...prev.slice(1)])
                    }
                  />
                  <Input
                    label="Target"
                    size="sm"
                    type="number"
                    value={fields[0]?.target?.toString() || ""}
                    onValueChange={(v) =>
                      setFields((prev) => [
                        { ...prev[0], target: v ? Number(v) : undefined },
                        ...prev.slice(1),
                      ])
                    }
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-default-500 uppercase">Fields</span>
                  <Button size="sm" variant="flat" startContent={<Plus size={12} />} onPress={addField}>
                    Add field
                  </Button>
                </div>
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <Input
                        size="sm"
                        placeholder="Label (e.g. Protein)"
                        value={f.label}
                        onValueChange={(v) => updateField(f.id, { label: v })}
                        className="col-span-5"
                      />
                      <Input
                        size="sm"
                        placeholder="Unit (g, kg, ...)"
                        value={f.unit || ""}
                        onValueChange={(v) => updateField(f.id, { unit: v })}
                        className="col-span-3"
                      />
                      <Input
                        size="sm"
                        type="number"
                        placeholder="Target"
                        value={f.target?.toString() || ""}
                        onValueChange={(v) =>
                          updateField(f.id, { target: v ? Number(v) : undefined })
                        }
                        className="col-span-3"
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        className="col-span-1 w-7 h-7 min-w-7"
                        isDisabled={fields.length === 1}
                        onPress={() => removeField(f.id)}
                        aria-label="Remove field"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-default-400 mt-1.5">
                  Add multiple fields for composite trackers (e.g. protein, fat, calories).
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={submitting} isDisabled={!name.trim()}>
            {tracker ? "Save" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
