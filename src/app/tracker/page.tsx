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
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import {
  useTrackers,
  useTrackerEntries,
  useTrackerMutations,
} from "@/hooks/use-trackers";
import { useTasks } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs } from "@/hooks/use-habits";
import {
  Tracker,
  TrackerEntry,
  TrackerField,
  TrackerFrequency,
  TrackerSource,
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

const FREQUENCY_OPTIONS: { key: TrackerFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const SOURCE_OPTIONS: { key: TrackerSource; label: string }[] = [
  { key: "manual", label: "Manual entry" },
  { key: "habits_completed", label: "Auto: Habits completed" },
  { key: "tasks_completed", label: "Auto: Tasks completed" },
];

const COLOR_OPTIONS = ["primary", "success", "warning", "secondary", "danger", "default"];

function periodKey(d: Date, freq: TrackerFrequency): string {
  if (freq === "daily") return format(d, "yyyy-MM-dd");
  if (freq === "weekly") {
    const yr = getISOWeekYear(d);
    const wk = getISOWeek(d);
    return `${yr}-W${String(wk).padStart(2, "0")}`;
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
    if (!m) return key;
    return `W${m[2]}`;
  }
  try {
    return format(parseISO(`${key}-01`), "MMM yy");
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

export default function TrackerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { trackers, loading: trackersLoading } = useTrackers();
  const { entries } = useTrackerEntries();
  const { addTracker, updateTracker, deleteTracker, upsertEntry } = useTrackerMutations();
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const { logs } = useHabitLogs(undefined, 365);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editing, setEditing] = useState<Tracker | null>(null);

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

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    onOpen();
  };
  const openEdit = (t: Tracker) => {
    setEditing(t);
    onOpen();
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
                Track anything: weight, steps, calories, tasks completed, habits done...
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
                tasks={tasks}
                habitLogs={logs}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTracker(t.id)}
                onSaveEntry={(periodKey, values, notes) =>
                  upsertEntry(t.id, periodKey, values, notes)
                }
              />
            ))}
          </div>
        )}
      </main>

      <TrackerFormModal
        isOpen={isOpen}
        onClose={onClose}
        tracker={editing}
        onSubmit={async (data) => {
          if (editing) {
            await updateTracker(editing.id, data);
          } else {
            await addTracker(data);
          }
          onClose();
        }}
      />
    </div>
  );
}

function TrackerCard({
  tracker,
  entries,
  tasks,
  habitLogs,
  onEdit,
  onDelete,
  onSaveEntry,
}: {
  tracker: Tracker;
  entries: TrackerEntry[];
  tasks: any[];
  habitLogs: any[];
  onEdit: () => void;
  onDelete: () => void;
  onSaveEntry: (periodKey: string, values: Record<string, number>, notes?: string) => Promise<void>;
}) {
  const today = new Date();
  const currentKey = periodKey(today, tracker.frequency);
  const isAuto = tracker.source !== "manual";

  const computeAutoValue = (periodDate: Date): number => {
    const { start, end } = periodRange(periodDate, tracker.frequency);
    if (tracker.source === "habits_completed") {
      const startKey = format(start, "yyyy-MM-dd");
      const endKey = format(end, "yyyy-MM-dd");
      return habitLogs.filter(
        (l: any) => l.completed && l.date >= startKey && l.date <= endKey
      ).length;
    }
    if (tracker.source === "tasks_completed") {
      return tasks.filter((t: any) => {
        if (t.status !== "completed") return false;
        const ref = t.updatedAt?.toDate?.() || t.scheduledDate?.toDate?.();
        if (!ref) return false;
        return isWithinInterval(ref, { start, end });
      }).length;
    }
    return 0;
  };

  const entryFor = (key: string) => entries.find((e) => e.periodKey === key);

  const recent = useMemo(() => {
    const periods = lastNPeriods(tracker.frequency, 7).reverse();
    return periods.map((d) => {
      const key = periodKey(d, tracker.frequency);
      let total = 0;
      const fieldVals: Record<string, number> = {};
      if (isAuto) {
        total = computeAutoValue(d);
        fieldVals[tracker.fields[0]?.id || "value"] = total;
      } else {
        const e = entryFor(key);
        for (const f of tracker.fields) {
          const v = e?.values?.[f.id] ?? 0;
          fieldVals[f.id] = v;
          total += v;
        }
      }
      return { date: d, key, total, fieldVals };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker, entries, isAuto, tasks, habitLogs]);

  const currentEntry = entryFor(currentKey);
  const currentValues: Record<string, number> = isAuto
    ? { [tracker.fields[0]?.id || "value"]: computeAutoValue(today) }
    : Object.fromEntries(
        tracker.fields.map((f) => [f.id, currentEntry?.values?.[f.id] ?? 0])
      );

  const colorClass = (color?: string) => {
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
  };

  const bgClass = (color?: string) => {
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
  };

  const SourceIcon =
    tracker.source === "habits_completed"
      ? Flame
      : tracker.source === "tasks_completed"
      ? CheckCircle2
      : LineChart;

  const maxRecent = Math.max(1, ...recent.map((r) => r.total));

  return (
    <Card shadow="sm" className="h-full">
      <CardHeader className="flex justify-between items-start px-4 pt-3 pb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-default-100 shrink-0">
            {tracker.icon ? (
              <span className="text-base">{tracker.icon}</span>
            ) : (
              <SourceIcon size={16} className={colorClass(tracker.color)} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" title={tracker.name}>
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
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
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
          colorClass={colorClass(tracker.color)}
        />

        <div className="mt-3 pt-3 border-t border-default-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-default-400 uppercase">
              Last 7 {tracker.frequency === "daily" ? "days" : tracker.frequency === "weekly" ? "weeks" : "months"}
            </span>
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
                      className={`w-full rounded-t ${bgClass(tracker.color)} ${
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

function formatTotal(value: number, tracker: Tracker): string {
  const unit = tracker.fields.length === 1 ? tracker.fields[0]?.unit : undefined;
  return unit ? `${value} ${unit}` : String(value);
}

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

  // Reset draft when persisted values or period roll over.
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

function newFieldId() {
  return Math.random().toString(36).slice(2, 9);
}

function TrackerFormModal({
  isOpen,
  onClose,
  tracker,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  tracker: Tracker | null;
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (tracker) {
      setName(tracker.name);
      setIcon(tracker.icon || "");
      setColor(tracker.color || "primary");
      setFrequency(tracker.frequency);
      setSource(tracker.source);
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
          {
            id: "value",
            label: "Count",
            unit: fields[0]?.unit?.trim() || undefined,
            target: typeof fields[0]?.target === "number" ? fields[0]?.target : undefined,
          },
        ]
      : fields.map((f) => ({
          id: f.id,
          label: f.label.trim() || "Value",
          unit: f.unit?.trim() || undefined,
          target:
            typeof f.target === "number" && !Number.isNaN(f.target) ? f.target : undefined,
        }));
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmed,
        icon: icon.trim() || undefined,
        color,
        frequency,
        source,
        fields: finalFields,
      } as any);
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
                onSelectionChange={(keys) =>
                  setSource(Array.from(keys)[0] as TrackerSource)
                }
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
              <div className="rounded-lg bg-default-50 p-3 text-xs text-default-600">
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <Activity size={12} />
                  Auto-derived value
                </div>
                <p className="text-default-500">
                  This tracker reads from your{" "}
                  {source === "habits_completed" ? "habit completions" : "completed tasks"} for the
                  current period. You can still set a target and unit.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
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
