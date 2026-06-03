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
  Progress,
  Switch,
  Tooltip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Plus,
  Flame,
  TrendingUp,
  Trash2,
  GripVertical,
  Minus,
  Pencil,
  Pause,
  Play,
  BarChart3,
  Calendar as CalendarIcon,
  Filter,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { HabitCategory, HabitFrequency, HabitType, Habit } from "@/types";
import {
  describeHabitSchedule,
  isHabitVisibleOn,
  DEFAULT_WEEKEND_DAYS,
  DEFAULT_MONTH_END_START,
  DEFAULT_MONTH_END_END,
  DEFAULT_QUARTER_END_START,
  DEFAULT_QUARTER_END_END,
} from "@/lib/habit-visibility";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { parseLocalDate } from "@/lib/time";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

const categoryOptions: { key: HabitCategory; label: string }[] = [
  { key: "morning", label: "🌅 Morning" },
  { key: "all_day", label: "☀️ All Day" },
  { key: "night", label: "🌙 Night" },
  { key: "weekend", label: "📅 Weekend" },
  { key: "month_end", label: "📆 Month End" },
  { key: "quarter_end", label: "🗓️ Quarter End" },
];

const frequencyOptions: { key: HabitFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom days" },
];

const COLOR_OPTIONS = ["primary", "success", "warning", "secondary", "danger"] as const;
type HabitColor = (typeof COLOR_OPTIONS)[number];
const colorClass: Record<HabitColor, { dot: string; ring: string; bg: string }> = {
  primary: { dot: "bg-primary", ring: "ring-primary", bg: "bg-primary/10" },
  success: { dot: "bg-success", ring: "ring-success", bg: "bg-success/10" },
  warning: { dot: "bg-warning", ring: "ring-warning", bg: "bg-warning/10" },
  secondary: { dot: "bg-secondary", ring: "ring-secondary", bg: "bg-secondary/10" },
  danger: { dot: "bg-danger", ring: "ring-danger", bg: "bg-danger/10" },
};

const WEEKDAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SortMode = "order" | "streak" | "name" | "category";

function HabitActivityRow({ habit, days }: { habit: Habit; days: number }) {
  const { logs } = useHabitLogs(habit.id, days);
  const today = new Date();
  const dayList = eachDayOfInterval({ start: subDays(today, days - 1), end: today });
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const completionsInWindow = dayList.filter((d) => completedDates.has(format(d, "yyyy-MM-dd"))).length;
  const rate = dayList.length > 0 ? Math.round((completionsInWindow / dayList.length) * 100) : 0;

  return (
    <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
      <div className="flex items-center gap-1.5 w-36 shrink-0 min-w-0">
        {habit.icon && <span className="text-xs shrink-0">{habit.icon}</span>}
        <span title={habit.title} className="text-[11px] text-default-600 truncate">{habit.title}</span>
      </div>
      <div className="flex gap-[2px] flex-wrap flex-1 min-w-0">
        {dayList.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const done = completedDates.has(dateStr);
          return (
            <div
              key={dateStr}
              className={`w-2 h-2 rounded-[2px] ${done ? "bg-success" : "bg-default-100"}`}
              title={`${dateStr}${done ? " ✓" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-[10px] text-default-500">
        <span className="flex items-center gap-0.5 text-warning" title="Current streak">
          <Flame size={10} /> {habit.streak || 0}
        </span>
        <span className="flex items-center gap-0.5 text-success" title="Longest streak">
          <TrendingUp size={10} /> {habit.longestStreak || 0}
        </span>
        <span title={`Completed ${completionsInWindow} of ${days} days`}>
          {completionsInWindow}/{days}
        </span>
        <span className="font-medium text-default-600 w-9 text-right" title="Completion rate">
          {rate}%
        </span>
      </div>
    </div>
  );
}

function HabitsActivityCard({ habits, days }: { habits: Habit[]; days: number }) {
  return (
    <Card shadow="sm">
      <CardHeader className="px-4 py-2 flex justify-between">
        <span className="text-xs font-semibold">{days}-Day Activity</span>
        <span className="text-[10px] text-default-400">Streaks, completions and rate over last {days} days</span>
      </CardHeader>
      <CardBody className="pt-0 px-4 pb-3 space-y-2">
        {habits.map((habit) => (
          <HabitActivityRow key={habit.id} habit={habit} days={days} />
        ))}
      </CardBody>
    </Card>
  );
}

function MiniHeatmap({ habitId, weeks = 4 }: { habitId: string; weeks?: number }) {
  const days = weeks * 7;
  const { logs } = useHabitLogs(habitId, days);
  const today = new Date();
  const dayList = eachDayOfInterval({ start: subDays(today, days - 1), end: today });
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));

  return (
    <div className="flex gap-[2px] flex-wrap">
      {dayList.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        return (
          <div
            key={dateStr}
            className={`w-2 h-2 rounded-[2px] ${
              completedDates.has(dateStr) ? "bg-success" : "bg-default-100"
            }`}
            title={dateStr}
          />
        );
      })}
    </div>
  );
}

function FullHeatmap({ habitId, weeks = 26 }: { habitId: string; weeks?: number }) {
  const days = weeks * 7;
  const { logs } = useHabitLogs(habitId, days);
  const today = new Date();
  // Align to the start of the week containing the earliest day
  const earliest = subDays(today, days - 1);
  const start = startOfWeek(earliest, { weekStartsOn: 0 });
  const end = endOfWeek(today, { weekStartsOn: 0 });
  const dayList = eachDayOfInterval({ start, end });
  const completedByDate = new Map<string, number>();
  for (const log of logs) {
    if (log.completed) completedByDate.set(log.date, (log.count as number) || 1);
  }
  // Build grid: 7 rows (Sun..Sat) x columns
  const cols: Date[][] = [];
  for (let i = 0; i < dayList.length; i += 7) {
    cols.push(dayList.slice(i, i + 7));
  }
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((d) => {
              const ds = format(d, "yyyy-MM-dd");
              const completed = completedByDate.has(ds);
              const isFuture = d > today;
              return (
                <div
                  key={ds}
                  className={`w-3 h-3 rounded-[3px] ${
                    isFuture
                      ? "bg-transparent"
                      : completed
                      ? "bg-success"
                      : "bg-default-100"
                  }`}
                  title={`${ds}${completed ? " ✓" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableHabit({
  habit,
  isCompleted,
  currentCount,
  onToggle,
  onIncrement,
  onDecrement,
  onDelete,
  onEdit,
  onOpenStats,
  onTogglePause,
}: {
  habit: Habit;
  isCompleted: boolean;
  currentCount: number;
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenStats: () => void;
  onTogglePause: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: habit.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isCounter = habit.type === "counter";
  const progress = isCounter && habit.targetCount ? Math.min((currentCount / habit.targetCount) * 100, 100) : 0;
  const color = (habit.color as HabitColor | undefined) ?? "primary";
  const cls = colorClass[color] ?? colorClass.primary;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 p-2 rounded-lg border border-divider hover:border-primary/20 transition-all group mb-2 bg-content1 ${
        habit.isPaused ? "opacity-60" : ""
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={12} className="text-default-400" />
      </button>

      <div className={`w-1 h-6 rounded-full ${cls.dot} shrink-0`} />

      {isCounter ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {habit.icon && <span className="text-sm">{habit.icon}</span>}
              <span className={`text-sm font-medium truncate ${isCompleted ? "text-success" : ""}`}>
                {habit.title}
              </span>
              {habit.streak > 0 && (
                <Chip size="sm" color="warning" variant="flat" className="h-4 shrink-0" startContent={<Flame size={8} />}>
                  {habit.streak}
                </Chip>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress size="sm" value={progress} color={isCompleted ? "success" : "primary"} className="flex-1 max-w-[150px]" />
              <span className="text-[10px] text-default-500 shrink-0">
                {currentCount}/{habit.targetCount} {habit.unit || ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" isIconOnly variant="flat" className="w-6 h-6 min-w-6" onPress={onDecrement} isDisabled={currentCount <= 0}>
              <Minus size={12} />
            </Button>
            <span className="text-sm font-bold w-6 text-center">{currentCount}</span>
            <Button size="sm" isIconOnly variant="flat" color="primary" className="w-6 h-6 min-w-6" onPress={onIncrement}>
              <Plus size={12} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer shrink-0 transition-all ${
              isCompleted ? "bg-success border-success scale-105" : "border-default-300 hover:border-primary"
            }`}
            onClick={onToggle}
          >
            {isCompleted && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {habit.icon && <span className="text-sm">{habit.icon}</span>}
              <span className={`text-sm font-medium truncate block ${isCompleted ? "text-default-400 line-through" : ""}`}>
                {habit.title}
              </span>
            </div>
          </div>
          {habit.streak > 0 && (
            <Chip size="sm" color="warning" variant="flat" className="h-5 shrink-0" startContent={<Flame size={10} />}>
              {habit.streak}
            </Chip>
          )}
        </div>
      )}

      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <Tooltip content="Stats" delay={400}>
          <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onOpenStats}>
            <BarChart3 size={12} />
          </Button>
        </Tooltip>
        <Tooltip content="Edit" delay={400}>
          <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onEdit}>
            <Pencil size={12} />
          </Button>
        </Tooltip>
        <Tooltip content={habit.isPaused ? "Resume" : "Pause"} delay={400}>
          <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onTogglePause}>
            {habit.isPaused ? <Play size={12} /> : <Pause size={12} />}
          </Button>
        </Tooltip>
        <Tooltip content="Archive" delay={400}>
          <Button isIconOnly size="sm" variant="light" color="danger" className="w-6 h-6 min-w-6" onPress={onDelete}>
            <Trash2 size={12} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

interface HabitFormState {
  title: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  type: HabitType;
  targetCount: string;
  unit: string;
  customDays: number[];
  weekendDays: number[];
  monthEndStartDay: string;
  monthEndEndDay: string;
  quarterEndStartDay: string;
  quarterEndEndDay: string;
  color: HabitColor;
  icon: string;
  description: string;
}

const emptyForm: HabitFormState = {
  title: "",
  category: "morning",
  frequency: "daily",
  type: "checkbox",
  targetCount: "1",
  unit: "",
  customDays: [],
  weekendDays: DEFAULT_WEEKEND_DAYS,
  monthEndStartDay: String(DEFAULT_MONTH_END_START),
  monthEndEndDay: String(DEFAULT_MONTH_END_END),
  quarterEndStartDay: String(DEFAULT_QUARTER_END_START),
  quarterEndEndDay: String(DEFAULT_QUARTER_END_END),
  color: "primary",
  icon: "",
  description: "",
};

export default function HabitsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { habits, loading: habitsLoading } = useHabits();
  const { logs } = useHabitLogs(undefined, 90);
  const {
    addHabit,
    updateHabit,
    setHabitPaused,
    toggleHabitLog,
    updateHabitCount,
    reorderHabits,
    deleteHabit,
  } = useHabitMutations();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const statsDisclosure = useDisclosure();

  const [form, setForm] = useState<HabitFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statsHabit, setStatsHabit] = useState<Habit | null>(null);

  const [showOnlyToday, setShowOnlyToday] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const today = useMemo(() => parseLocalDate(format(new Date(), "yyyy-MM-dd")), []);
  const todayDate = format(today, "yyyy-MM-dd");

  const completedDatesByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!l.completed) continue;
      let s = map.get(l.habitId);
      if (!s) { s = new Set<string>(); map.set(l.habitId, s); }
      s.add(l.date);
    }
    return map;
  }, [logs]);

  const isHabitCompletedToday = (habit: Habit): boolean => {
    const dates = completedDatesByHabit.get(habit.id);
    if (!dates || dates.size === 0) return false;
    if (habit.frequency === "weekly") {
      const start = startOfWeek(today, { weekStartsOn: 0 });
      const end = endOfWeek(today, { weekStartsOn: 0 });
      for (const d of eachDayOfInterval({ start, end })) {
        if (dates.has(format(d, "yyyy-MM-dd"))) return true;
      }
      return false;
    }
    if (habit.frequency === "monthly") {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      for (const d of eachDayOfInterval({ start, end })) {
        if (dates.has(format(d, "yyyy-MM-dd"))) return true;
      }
      return false;
    }
    return dates.has(todayDate);
  };

  const filteredHabits = useMemo(() => {
    let list = habits;
    if (showOnlyToday) list = list.filter((h) => isHabitVisibleOn(h, today, { completedDates: completedDatesByHabit.get(h.id) }));
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [habits, showOnlyToday, today, completedDatesByHabit]);

  const visibleToday = habits.filter((h) => isHabitVisibleOn(h, today, { completedDates: completedDatesByHabit.get(h.id) }));
  const completedToday = visibleToday.filter((h) => isHabitCompletedToday(h)).length;
  const longestStreak = Math.max(0, ...habits.map((h) => h.longestStreak || 0));

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    onOpen();
  };

  const openEdit = (h: Habit) => {
    setEditingId(h.id);
    setForm({
      title: h.title,
      category: h.category,
      frequency: h.frequency,
      type: h.type,
      targetCount: String(h.targetCount ?? 1),
      unit: h.unit ?? "",
      customDays: h.customDays ?? [],
      weekendDays: h.weekendDays ?? DEFAULT_WEEKEND_DAYS,
      monthEndStartDay: String(h.monthEndStartDay ?? DEFAULT_MONTH_END_START),
      monthEndEndDay: String(h.monthEndEndDay ?? DEFAULT_MONTH_END_END),
      quarterEndStartDay: String(h.quarterEndStartDay ?? DEFAULT_QUARTER_END_START),
      quarterEndEndDay: String(h.quarterEndEndDay ?? DEFAULT_QUARTER_END_END),
      color: ((h.color as HabitColor | undefined) ?? "primary"),
      icon: h.icon ?? "",
      description: h.description ?? "",
    });
    onOpen();
  };

  const buildPayload = () => {
    const payload: Partial<Habit> = {
      title: form.title.trim(),
      category: form.category,
      frequency: form.frequency,
      type: form.type,
      targetCount: form.type === "counter" ? parseInt(form.targetCount) || 1 : undefined,
      unit: form.type === "counter" ? form.unit.trim() || undefined : undefined,
      color: form.color,
      icon: form.icon.trim() || undefined,
      description: form.description.trim() || undefined,
      customDays: form.frequency === "custom" ? form.customDays : undefined,
      weekendDays: form.category === "weekend" ? form.weekendDays : undefined,
      monthEndStartDay: form.category === "month_end" ? parseInt(form.monthEndStartDay) || DEFAULT_MONTH_END_START : undefined,
      monthEndEndDay: form.category === "month_end" ? parseInt(form.monthEndEndDay) || DEFAULT_MONTH_END_END : undefined,
      quarterEndStartDay: form.category === "quarter_end" ? parseInt(form.quarterEndStartDay) || DEFAULT_QUARTER_END_START : undefined,
      quarterEndEndDay: form.category === "quarter_end" ? parseInt(form.quarterEndEndDay) || DEFAULT_QUARTER_END_END : undefined,
    };
    return payload;
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    const payload = buildPayload();
    if (editingId) {
      await updateHabit(editingId, payload);
    } else {
      await addHabit({
        title: payload.title!,
        category: payload.category!,
        frequency: payload.frequency!,
        type: payload.type!,
        targetCount: payload.targetCount,
        unit: payload.unit,
        color: payload.color,
        icon: payload.icon,
        description: payload.description,
        customDays: payload.customDays,
        weekendDays: payload.weekendDays,
        monthEndStartDay: payload.monthEndStartDay,
        monthEndEndDay: payload.monthEndEndDay,
        quarterEndStartDay: payload.quarterEndStartDay,
        quarterEndEndDay: payload.quarterEndEndDay,
        order: habits.length,
        isActive: true,
      });
    }
    setForm(emptyForm);
    setEditingId(null);
    onClose();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredHabits.findIndex((h) => h.id === active.id);
    const newIdx = filteredHabits.findIndex((h) => h.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(filteredHabits, oldIdx, newIdx);
    reorderHabits(newOrder.map((h) => h.id));
  };

  const openStats = (h: Habit) => {
    setStatsHabit(h);
    statsDisclosure.onOpen();
  };

  const toggleCustomDay = (d: number) => {
    setForm((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(d)
        ? prev.customDays.filter((x) => x !== d)
        : [...prev.customDays, d].sort(),
    }));
  };

  const toggleWeekendDay = (d: number) => {
    setForm((prev) => ({
      ...prev,
      weekendDays: prev.weekendDays.includes(d)
        ? prev.weekendDays.filter((x) => x !== d)
        : [...prev.weekendDays, d].sort(),
    }));
  };

  const previewSchedule = describeHabitSchedule({
    frequency: form.frequency,
    category: form.category,
    customDays: form.customDays,
    weekendDays: form.weekendDays,
    monthEndStartDay: parseInt(form.monthEndStartDay) || undefined,
    monthEndEndDay: parseInt(form.monthEndEndDay) || undefined,
    quarterEndStartDay: parseInt(form.quarterEndStartDay) || undefined,
    quarterEndEndDay: parseInt(form.quarterEndEndDay) || undefined,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 lg:px-[7%] py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Habits</h1>
              <p className="text-default-500 text-xs">
                {completedToday}/{visibleToday.length} today · {habits.length} total · Best streak: {longestStreak}
              </p>
            </div>
            <Button color="primary" size="sm" startContent={<Plus size={16} />} onPress={openCreate}>
              Add
            </Button>
          </div>

          {/* Today's Progress */}
          <Card shadow="sm">
            <CardBody className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Today&apos;s Progress</span>
                <span className="text-xs text-default-500">{completedToday}/{visibleToday.length}</span>
              </div>
              <Progress
                value={visibleToday.length > 0 ? (completedToday / visibleToday.length) * 100 : 0}
                color="success"
                size="md"
              />
            </CardBody>
          </Card>

          {/* Filters / sort */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-default-500 ml-auto">
              <Filter size={12} />
              <span>Today only</span>
              <Switch size="sm" aria-label="Show only today's habits" isSelected={showOnlyToday} onValueChange={setShowOnlyToday} />
            </div>
          </div>

          {/* Habit Columns by Category */}
          {filteredHabits.length === 0 ? (
            <Card shadow="sm">
              <CardBody className="text-center py-8">
                <p className="text-default-400 text-sm">
                  {habits.length === 0 ? "No habits yet" : "No habits match the current filter"}
                </p>
                {habits.length === 0 && (
                  <Button color="primary" variant="flat" size="sm" className="mt-2" onPress={openCreate}>
                    Create your first habit
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            (() => {
              const groups = categoryOptions
                .map((c) => ({ ...c, items: filteredHabits.filter((h) => h.category === c.key) }))
                .filter((g) => g.items.length > 0);
              return (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  {groups.map((group) => (
                    <Card key={group.key} shadow="sm" className="h-fit">
                      <CardHeader className="px-3 py-2 flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase text-default-600">{group.label}</span>
                        <Chip size="sm" variant="flat" className="h-5">{group.items.length}</Chip>
                      </CardHeader>
                      <CardBody className="pt-0 px-2 pb-2">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                          modifiers={[restrictToVerticalAxis]}
                        >
                          <SortableContext items={group.items.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                            {group.items.map((habit) => {
                              const log = logs.find((l) => l.habitId === habit.id && l.date === todayDate);
                              const isCompleted = log?.completed || false;
                              const currentCount = log?.count || 0;
                              return (
                                <SortableHabit
                                  key={habit.id}
                                  habit={habit}
                                  isCompleted={isCompleted}
                                  currentCount={currentCount}
                                  onToggle={() => toggleHabitLog(habit.id, todayDate, !isCompleted)}
                                  onIncrement={() => updateHabitCount(habit.id, todayDate, currentCount + 1, habit.targetCount || 1)}
                                  onDecrement={() => updateHabitCount(habit.id, todayDate, Math.max(0, currentCount - 1), habit.targetCount || 1)}
                                  onDelete={() => deleteHabit(habit.id)}
                                  onEdit={() => openEdit(habit)}
                                  onOpenStats={() => openStats(habit)}
                                  onTogglePause={() => setHabitPaused(habit.id, !habit.isPaused)}
                                />
                              );
                            })}
                          </SortableContext>
                        </DndContext>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              );
            })()
          )}

          {/* Heatmaps */}
          {habits.length > 0 && (
            <HabitsActivityCard habits={habits} days={100} />
          )}
        </motion.div>

        {/* Create/Edit Habit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside">
          <ModalContent>
            {(close) => (
              <>
                <ModalHeader>{editingId ? "Edit Habit" : "Create Habit"}</ModalHeader>
                <ModalBody className="space-y-3">
                  <Input
                    label="Habit Name"
                    placeholder="e.g., Drink water, Meditate"
                    value={form.title}
                    onValueChange={(v) => setForm({ ...form, title: v })}
                    isRequired
                    variant="bordered"
                    size="sm"
                  />
                  <Input
                    label="Description (optional)"
                    placeholder="Why this matters..."
                    value={form.description}
                    onValueChange={(v) => setForm({ ...form, description: v })}
                    variant="bordered"
                    size="sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Category"
                      variant="bordered"
                      size="sm"
                      selectedKeys={[form.category]}
                      onSelectionChange={(k) => setForm({ ...form, category: Array.from(k)[0] as HabitCategory })}
                    >
                      {categoryOptions.map((c) => <SelectItem key={c.key}>{c.label}</SelectItem>)}
                    </Select>
                    <Select
                      label="Frequency"
                      variant="bordered"
                      size="sm"
                      selectedKeys={[form.frequency]}
                      onSelectionChange={(k) => setForm({ ...form, frequency: Array.from(k)[0] as HabitFrequency })}
                    >
                      {frequencyOptions.map((f) => <SelectItem key={f.key}>{f.label}</SelectItem>)}
                    </Select>
                  </div>

                  {/* Color + Icon */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-default-500 mb-1">Color</p>
                      <div className="flex gap-1.5">
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={c}
                            onClick={() => setForm({ ...form, color: c })}
                            className={`w-6 h-6 rounded-full ${colorClass[c].dot} ${
                              form.color === c ? `ring-2 ring-offset-2 ring-offset-content1 ${colorClass[c].ring}` : ""
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <Input
                      label="Icon (emoji)"
                      placeholder="💧"
                      value={form.icon}
                      onValueChange={(v) => setForm({ ...form, icon: v })}
                      variant="bordered"
                      size="sm"
                    />
                  </div>

                  {/* Custom days picker */}
                  {form.frequency === "custom" && (
                    <div className="p-3 rounded-lg bg-content2 space-y-1">
                      <p className="text-xs font-medium">Show on these days</p>
                      <div className="flex gap-1">
                        {WEEKDAY_NAMES.map((n, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCustomDay(idx)}
                            className={`w-8 h-8 rounded-full text-xs font-medium border-2 transition-colors ${
                              form.customDays.includes(idx)
                                ? "bg-primary text-white border-primary"
                                : "border-default-300 text-default-500 hover:border-primary"
                            }`}
                            title={WEEKDAY_FULL[idx]}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category-specific config */}
                  {form.category === "weekend" && form.frequency !== "custom" && (
                    <div className="p-3 rounded-lg bg-content2 space-y-1">
                      <p className="text-xs font-medium">Weekend window (days of week)</p>
                      <div className="flex gap-1">
                        {WEEKDAY_NAMES.map((n, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleWeekendDay(idx)}
                            className={`w-8 h-8 rounded-full text-xs font-medium border-2 transition-colors ${
                              form.weekendDays.includes(idx)
                                ? "bg-primary text-white border-primary"
                                : "border-default-300 text-default-500 hover:border-primary"
                            }`}
                            title={WEEKDAY_FULL[idx]}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.category === "month_end" && form.frequency !== "custom" && (
                    <div className="p-3 rounded-lg bg-content2 space-y-2">
                      <p className="text-xs font-medium">Month-end window</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min={1} max={31}
                          label="Start day (this month)"
                          value={form.monthEndStartDay}
                          onValueChange={(v) => setForm({ ...form, monthEndStartDay: v })}
                          variant="bordered"
                          size="sm"
                        />
                        <Input
                          type="number"
                          min={1} max={31}
                          label="End day (next month)"
                          value={form.monthEndEndDay}
                          onValueChange={(v) => setForm({ ...form, monthEndEndDay: v })}
                          variant="bordered"
                          size="sm"
                        />
                      </div>
                    </div>
                  )}

                  {form.category === "quarter_end" && form.frequency !== "custom" && (
                    <div className="p-3 rounded-lg bg-content2 space-y-2">
                      <p className="text-xs font-medium">Quarter-end window</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min={1} max={31}
                          label="Start day (last quarter month)"
                          value={form.quarterEndStartDay}
                          onValueChange={(v) => setForm({ ...form, quarterEndStartDay: v })}
                          variant="bordered"
                          size="sm"
                        />
                        <Input
                          type="number"
                          min={1} max={31}
                          label="End day (next quarter month)"
                          value={form.quarterEndEndDay}
                          onValueChange={(v) => setForm({ ...form, quarterEndEndDay: v })}
                          variant="bordered"
                          size="sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-content2">
                    <Switch
                      size="sm"
                      aria-label="Counter habit (track quantity)"
                      isSelected={form.type === "counter"}
                      onValueChange={(v) => setForm({ ...form, type: v ? "counter" : "checkbox" })}
                    />
                    <span className="text-sm">Counter habit (track quantity)</span>
                  </div>
                  {form.type === "counter" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        label="Target"
                        placeholder="8"
                        value={form.targetCount}
                        onValueChange={(v) => setForm({ ...form, targetCount: v })}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Unit"
                        placeholder="glasses, minutes, pages..."
                        value={form.unit}
                        onValueChange={(v) => setForm({ ...form, unit: v })}
                        variant="bordered"
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="text-[11px] text-default-500 italic px-1">
                    Schedule: {previewSchedule}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={close}>Cancel</Button>
                  <Button color="primary" size="sm" onPress={handleSubmit} isDisabled={!form.title.trim()}>
                    {editingId ? "Save" : "Create"}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Stats modal */}
        <Modal isOpen={statsDisclosure.isOpen} onOpenChange={statsDisclosure.onOpenChange} size="2xl" scrollBehavior="inside">
          <ModalContent>
            {(close) => (
              <>
                <ModalHeader className="flex items-center gap-2">
                  {statsHabit?.icon && <span>{statsHabit.icon}</span>}
                  <span>{statsHabit?.title || "Habit"}</span>
                </ModalHeader>
                <ModalBody className="space-y-4">
                  {statsHabit && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <Card shadow="sm">
                          <CardBody className="p-3 text-center">
                            <p className="text-2xl font-bold text-warning">{statsHabit.streak || 0}</p>
                            <p className="text-[10px] text-default-500 mt-1 flex items-center justify-center gap-1">
                              <Flame size={10} /> Current streak
                            </p>
                          </CardBody>
                        </Card>
                        <Card shadow="sm">
                          <CardBody className="p-3 text-center">
                            <p className="text-2xl font-bold text-success">{statsHabit.longestStreak || 0}</p>
                            <p className="text-[10px] text-default-500 mt-1 flex items-center justify-center gap-1">
                              <TrendingUp size={10} /> Longest streak
                            </p>
                          </CardBody>
                        </Card>
                        <Card shadow="sm">
                          <CardBody className="p-3 text-center">
                            <p className="text-2xl font-bold">
                              {logs.filter((l) => l.habitId === statsHabit.id && l.completed).length}
                            </p>
                            <p className="text-[10px] text-default-500 mt-1 flex items-center justify-center gap-1">
                              <CalendarIcon size={10} /> Completions (90d)
                            </p>
                          </CardBody>
                        </Card>
                      </div>
                      <Card shadow="sm">
                        <CardHeader className="px-4 py-2">
                          <span className="text-xs font-semibold">26-Week Heatmap</span>
                        </CardHeader>
                        <CardBody className="pt-0 px-4 pb-3">
                          <FullHeatmap habitId={statsHabit.id} weeks={26} />
                        </CardBody>
                      </Card>
                      <div className="text-xs text-default-500 italic px-1">
                        Schedule: {describeHabitSchedule(statsHabit)}
                      </div>
                    </>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={close}>Close</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
