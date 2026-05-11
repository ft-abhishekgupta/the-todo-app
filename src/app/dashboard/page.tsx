"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useLayoutEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Progress,
  Select,
  SelectItem,
  useDisclosure,
  Tooltip,
} from "@nextui-org/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Clock,
  Target,
  Flame,
  Timer,
  GripVertical,
  CheckCircle2,
  Briefcase,
  User,
  TrendingUp,
  Star,
  X,
  ChevronRight,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { SortableTaskItem } from "@/components/task/sortable-task-item";
import { TaskEditModal } from "@/components/task/task-edit-modal";
import { useTodayTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { usePomodoroSessions } from "@/hooks/use-pomodoro";
import { useSchedule } from "@/hooks/use-schedule";
import { useProjects } from "@/hooks/use-projects";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { dateFnsTimeFormat, formatTimeStr } from "@/lib/time";
import { isHabitVisibleOn } from "@/lib/habit-visibility";
import {
  Task,
  TaskPriority,
  TaskType,
  TaskSubtype,
  Subtask,
  Habit,
} from "@/types";
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
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const TASK_TYPES: {
  key: TaskType;
  label: string;
  icon: typeof Briefcase;
  color: string;
  subtypes: { key: TaskSubtype; label: string }[];
}[] = [
  {
    key: "work",
    label: "Work",
    icon: Briefcase,
    color: "text-primary",
    subtypes: [
      { key: "project_task", label: "Project" },
      { key: "general_task", label: "General" },
      { key: "chores", label: "Chores" },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    icon: User,
    color: "text-success",
    subtypes: [
      { key: "general_task", label: "General" },
      { key: "project_task", label: "Project" },
      { key: "chores", label: "Chores" },
      { key: "social", label: "Social" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    icon: TrendingUp,
    color: "text-warning",
    subtypes: [
      { key: "professional_learning", label: "Professional Learning" },
      { key: "personal_learning", label: "Personal Learning" },
      { key: "improvement", label: "Improvement" },
    ],
  },
  {
    key: "habit",
    label: "Habit",
    icon: Flame,
    color: "text-secondary",
    subtypes: [],
  },
];

const priorityColors: Record<TaskPriority, "default" | "primary" | "warning"> = {
  low: "default",
  medium: "primary",
  high: "warning",
};

function LiveClock({ fmt }: { fmt: "12h" | "24h" }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="text-center sm:text-right">
      <p className="text-2xl sm:text-3xl font-bold tabular-nums">{format(time, dateFnsTimeFormat(fmt, true))}</p>
      <p className="text-default-500 text-xs mt-0.5">{format(time, "EEEE, MMMM d, yyyy")}</p>
    </div>
  );
}

// Constrains the element's max-height so its bottom never exceeds the viewport
// (with a small bottom padding). Recomputes when layout above shifts.
function useViewportConstrainedMaxHeight(bottomPadding = 40, minHeight = 200) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        // Disable on small screens (let content flow naturally)
        if (window.innerWidth < 1024) {
          setMaxH(undefined);
          return;
        }
        const top = ref.current.getBoundingClientRect().top;
        const available = window.innerHeight - top - bottomPadding;
        setMaxH(Math.max(minHeight, available));
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(document.body);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute);
    };
  }, [bottomPadding, minHeight]);

  return { ref, maxH };
}

function TaskSection({
  type,
  tasks,
  focusTaskIds,
  onToggle,
  onSetFocus,
  onAddSubtask,
  onToggleSubtask,
  onReorderSubtasks,
  onUpdateTitle,
  onTogglePriority,
  onOpenEditModal,
  onUpdateSubtaskTitle,
  onDragEnd,
  onQuickAdd,
  sensors,
  projectsMap,
}: {
  type: (typeof TASK_TYPES)[number];
  tasks: Task[];
  focusTaskIds: ReadonlySet<string>;
  onToggle: (id: string, completed: boolean) => void;
  onSetFocus: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onUpdateTitle: (taskId: string, title: string) => void;
  onTogglePriority: (taskId: string, currentPriority: TaskPriority) => void;
  onOpenEditModal: (task: Task) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
  onDragEnd: (event: DragEndEvent, category: TaskType) => void;
  onQuickAdd: (title: string, category: TaskType, subtype?: TaskSubtype) => void;
  sensors: ReturnType<typeof useSensors>;
  projectsMap: Record<string, string>;
}){
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtype, setNewSubtype] = useState<TaskSubtype | "">(type.subtypes[0]?.key || "");
  const Icon = type.icon;

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const { ref: bodyRef, maxH } = useViewportConstrainedMaxHeight();

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onQuickAdd(newTitle.trim(), type.key, newSubtype || undefined);
    setNewTitle("");
    setIsAdding(false);
  };

  return (
    <Card shadow="sm" className="h-fit">
      <CardHeader className="flex justify-between items-center px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon size={16} className={type.color} />
          <span className="font-semibold text-sm">{type.label}</span>
          <Chip size="sm" variant="flat" className="h-5">{activeTasks.length}</Chip>
        </div>
        <Button size="sm" isIconOnly variant="light" onPress={() => setIsAdding(!isAdding)}>
          <Plus size={14} />
        </Button>
      </CardHeader>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 overflow-hidden"
          >
            <div className="flex gap-1.5 pb-2">
              <Input
                size="sm"
                variant="bordered"
                placeholder="Task title..."
                value={newTitle}
                onValueChange={setNewTitle}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                classNames={{ inputWrapper: "border-1 h-8" }}
                className="flex-1"
                autoFocus
              />
              {type.subtypes.length > 0 && (
                <Select
                  size="sm"
                  variant="bordered"
                  className="w-28"
                  selectedKeys={newSubtype ? [newSubtype] : []}
                  onSelectionChange={(k) => setNewSubtype(Array.from(k)[0] as TaskSubtype)}
                  aria-label="Subtype"
                >
                  {type.subtypes.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
              )}
              <Button size="sm" color="primary" isIconOnly className="h-8 w-8 min-w-8" onPress={handleAdd}>
                <Plus size={14} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardBody className="pt-0 px-2 pb-2">
        <div ref={bodyRef} style={maxH ? { maxHeight: maxH } : undefined} className="overflow-y-auto">
        {activeTasks.length === 0 ? (
          <p className="text-default-400 text-xs text-center py-4">No tasks</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, type.key)} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {type.subtypes.length > 0 ? (
                <>
                  {type.subtypes.map((sub) => {
                    const groupTasks = activeTasks.filter((t) => t.subtype === sub.key);
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={sub.key} className="mb-1.5">
                        <p className="text-[10px] font-semibold text-default-400 uppercase px-2 py-0.5">{sub.label}</p>
                        {groupTasks.map((task) => (
                          <SortableTaskItem
                            key={task.id}
                            task={task}
                            onToggle={onToggle}
                            onSetFocus={onSetFocus}
                            onAddSubtask={onAddSubtask}
                            onToggleSubtask={onToggleSubtask}
                            onReorderSubtasks={onReorderSubtasks}
                            onUpdateTitle={onUpdateTitle}
                            onTogglePriority={onTogglePriority}
                            onOpenEditModal={onOpenEditModal}
                            onUpdateSubtaskTitle={onUpdateSubtaskTitle}
                            isFocused={focusTaskIds.has(task.id)}
                            projectName={task.projectId ? projectsMap[task.projectId] : undefined}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {/* Tasks without subtype */}
                  {activeTasks.filter((t) => !t.subtype || !type.subtypes.some((s) => s.key === t.subtype)).length > 0 && (
                    <div className="mb-1.5">
                      <p className="text-[10px] font-semibold text-default-400 uppercase px-2 py-0.5">Other</p>
                      {activeTasks.filter((t) => !t.subtype || !type.subtypes.some((s) => s.key === t.subtype)).map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          onToggle={onToggle}
                          onSetFocus={onSetFocus}
                          onAddSubtask={onAddSubtask}
                          onToggleSubtask={onToggleSubtask}
                          onReorderSubtasks={onReorderSubtasks}
                          onUpdateTitle={onUpdateTitle}
                          onTogglePriority={onTogglePriority}
                          onOpenEditModal={onOpenEditModal}
                          onUpdateSubtaskTitle={onUpdateSubtaskTitle}
                          isFocused={focusTaskIds.has(task.id)}
                          projectName={task.projectId ? projectsMap[task.projectId] : undefined}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                activeTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onSetFocus={onSetFocus}
                    onAddSubtask={onAddSubtask}
                    onToggleSubtask={onToggleSubtask}
                    onReorderSubtasks={onReorderSubtasks}
                    onUpdateTitle={onUpdateTitle}
                    onTogglePriority={onTogglePriority}
                    onOpenEditModal={onOpenEditModal}
                    onUpdateSubtaskTitle={onUpdateSubtaskTitle}
                    isFocused={focusTaskIds.has(task.id)}
                    projectName={task.projectId ? projectsMap[task.projectId] : undefined}
                  />
                ))
              )}
            </SortableContext>
          </DndContext>
        )}
        </div>
      </CardBody>
    </Card>
  );
}

function HabitSection({
  habits,
  logs,
  todayDate,
  focusHabitId,
  onToggle,
  onIncrement,
  onSetFocusHabit,
  onDragEnd,
  sensors,
}: {
  habits: Habit[];
  logs: any[];
  todayDate: string;
  focusHabitId?: string;
  onToggle: (habitId: string, completed: boolean) => void;
  onIncrement: (habitId: string, count: number, target: number) => void;
  onSetFocusHabit: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const completedCount = habits.filter((h) =>
    logs.some((l: any) => l.habitId === h.id && l.date === todayDate && l.completed)
  ).length;

  const focusHabit = habits.find((h) => h.id === focusHabitId) || habits[0];
  const { ref: bodyRef, maxH } = useViewportConstrainedMaxHeight();

  return (
    <Card shadow="sm" className="h-fit">
      <CardHeader className="flex justify-between items-center px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-secondary" />
          <span className="font-semibold text-sm">Habits</span>
          <Chip size="sm" variant="flat" className="h-5">{completedCount}/{habits.length}</Chip>
        </div>
      </CardHeader>

      {focusHabit && (
        <div className="mx-3 mb-2 p-2 rounded-lg bg-secondary/5 border border-secondary/20">
          <div className="flex items-center gap-1.5">
            <Star size={10} className="text-secondary fill-secondary" />
            <span className="text-[10px] font-medium text-secondary uppercase">Focus Habit</span>
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">{focusHabit.title}</p>
        </div>
      )}

      <CardBody className="pt-0 px-2 pb-2">
        <div ref={bodyRef} style={maxH ? { maxHeight: maxH } : undefined} className="overflow-y-auto">
        {habits.length === 0 ? (
          <p className="text-default-400 text-xs text-center py-4">No habits</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
              {habits.map((habit) => {
                const log = logs.find((l: any) => l.habitId === habit.id && l.date === todayDate);
                const isCompleted = log?.completed || false;
                const currentCount = log?.count || 0;
                return (
                  <SortableHabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted={isCompleted}
                    currentCount={currentCount}
                    isFocused={habit.id === focusHabit?.id}
                    onToggle={() => onToggle(habit.id, !isCompleted)}
                    onIncrement={() => onIncrement(habit.id, currentCount + 1, habit.targetCount || 1)}
                    onSetFocus={() => onSetFocusHabit(habit.id)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
        </div>
      </CardBody>
    </Card>
  );
}

function SortableHabitRow({
  habit,
  isCompleted,
  currentCount,
  isFocused,
  onToggle,
  onIncrement,
  onSetFocus,
}: {
  habit: Habit;
  isCompleted: boolean;
  currentCount: number;
  isFocused: boolean;
  onToggle: () => void;
  onIncrement: () => void;
  onSetFocus: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: habit.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isCounter = habit.type === "counter";

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 p-2 rounded-lg hover:bg-content2 transition-colors group ${isFocused ? "bg-secondary/5" : ""}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none shrink-0">
        <GripVertical size={14} className="text-default-400" />
      </button>
      <button onClick={onSetFocus} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Star size={12} className={isFocused ? "text-secondary fill-secondary" : "text-default-300"} />
      </button>
      {isCounter ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-sm truncate ${isCompleted ? "text-success" : ""}`}>{habit.title}</span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Progress size="sm" value={habit.targetCount ? (currentCount / habit.targetCount) * 100 : 0} color={isCompleted ? "success" : "primary"} className="w-14" />
            <Button size="sm" isIconOnly variant="flat" color="primary" className="w-5 h-5 min-w-5" onPress={onIncrement}>
              <Plus size={10} />
            </Button>
            <span className="text-[10px] text-default-500">{currentCount}/{habit.targetCount}</span>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${isCompleted ? "bg-success border-success" : "border-default-300"}`}
            onClick={onToggle}
          >
            {isCompleted && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm flex-1 truncate ${isCompleted ? "text-default-400 line-through" : ""}`}>{habit.title}</span>
          {habit.streak > 0 && (
            <Chip size="sm" color="warning" variant="flat" className="h-5 shrink-0" startContent={<Flame size={8} />}>
              {habit.streak}
            </Chip>
          )}
        </>
      )}
    </div>
  );
}

function CompletedSidebar({
  tasks,
  isOpen,
  onToggle,
  onUncheck,
}: {
  tasks: Task[];
  isOpen: boolean;
  onToggle: () => void;
  onUncheck: (id: string) => void;
}) {
  const grouped = TASK_TYPES.reduce(
    (acc, type) => {
      const typeTasks = tasks.filter((t) => t.category === type.key);
      if (typeTasks.length > 0) acc[type.key] = typeTasks;
      return acc;
    },
    {} as Record<string, Task[]>
  );

  if (tasks.length === 0) return null;

  return (
    <div className="fixed right-0 top-16 bottom-0 z-30">
      <button
        onClick={onToggle}
        aria-label={isOpen ? "Hide completed tasks" : "Show completed tasks"}
        className="absolute bottom-4 bg-success/10 hover:bg-success/20 border border-success/30 rounded-l-lg p-2 transition-all"
        style={{ right: isOpen ? "320px" : "0" }}
      >
        <CheckCircle2 size={16} className="text-success" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", damping: 25 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-content1 border-l border-divider shadow-xl overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  Completed Today ({tasks.length})
                </h3>
                <Button isIconOnly size="sm" variant="light" onPress={onToggle}>
                  <X size={14} />
                </Button>
              </div>
              {Object.entries(grouped).map(([typeKey, typeTasks]) => {
                const typeConfig = TASK_TYPES.find((t) => t.key === typeKey);
                if (!typeConfig) return null;
                const Icon = typeConfig.icon;
                return (
                  <div key={typeKey} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={12} className={typeConfig.color} />
                      <span className="text-xs font-medium text-default-500 uppercase">{typeConfig.label}</span>
                    </div>
                    {typeTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 py-1 px-2 group">
                        <button
                          type="button"
                          onClick={() => onUncheck(task.id)}
                          aria-label={`Mark "${task.title}" as not completed`}
                          className="w-4 h-4 rounded-full bg-success border border-success flex items-center justify-center shrink-0 hover:bg-success/80 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 size={10} className="text-white" />
                        </button>
                        <span className="text-xs text-default-400 line-through truncate flex-1">{task.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const timeFmt = userProfile?.timeFormat || "12h";
  const router = useRouter();
  const { tasks: todayTasks } = useTodayTasks();
  const { habits } = useHabits();
  const { logs } = useHabitLogs(undefined, 1);
  const { sessions } = usePomodoroSessions();
  const { projects } = useProjects();
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const { events: scheduleEvents } = useSchedule(todayDate);
  const { addTask, updateTask, reorderTasks } = useTaskMutations();
  const { toggleHabitLog, updateHabitCount, reorderHabits } = useHabitMutations();
  const [completedOpen, setCompletedOpen] = useState(false);
  const [focusTaskIds, setFocusTaskIds] = useState<string[]>([]);
  const [focusHabitId, setFocusHabitId] = useState<string>("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onOpenChange: onEditModalOpenChange } = useDisclosure();

  // Tick once per minute so the schedule's "now" marker re-renders without
  // requiring the user to interact with the page.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const projectsMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeTasks = todayTasks.filter((t) => t.status !== "completed");
  const completedTasks = todayTasks.filter((t) => t.status === "completed");
  const today = useMemo(() => new Date(), []);
  const visibleHabits = useMemo(() => habits.filter((h) => isHabitVisibleOn(h, today)), [habits, today]);
  const completedHabits = logs.filter((l) => l.date === todayDate && l.completed && visibleHabits.some((h) => h.id === l.habitId)).length;
  const completedPomodoros = sessions.filter((s) => s.isCompleted).length;

  const handleToggleTask = (id: string, completed: boolean) => {
    updateTask(id, { status: completed ? "completed" : "not_started" });
  };

  // Toggle a task's focus state. Up to 4 explicit focuses across all sections;
  // multiple from the same section are allowed. Adding a 5th drops the oldest.
  const handleSetFocus = (taskId: string) => {
    setFocusTaskIds((prev) => {
      if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
      const next = [...prev, taskId];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
  };

  const focusTaskIdSet = new Set(focusTaskIds);

  const handleAddSubtask = (taskId: string, title: string) => {
    const task = todayTasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSubtask: Subtask = { id: crypto.randomUUID(), title, completed: false };
    updateTask(taskId, { subtasks: [...(task.subtasks || []), newSubtask] });
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = todayTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask(taskId, { subtasks: updated });
  };

  const handleReorderSubtasks = (taskId: string, subtasks: Subtask[]) => {
    updateTask(taskId, { subtasks });
  };

  const handleDragEnd = (event: DragEndEvent, category: TaskType) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const categoryTasks = activeTasks.filter((t) => t.category === category);
    const oldIdx = categoryTasks.findIndex((t) => t.id === active.id);
    const newIdx = categoryTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(categoryTasks, oldIdx, newIdx);
    reorderTasks(newOrder.map((t) => t.id));
  };

  const handleHabitDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = habits.findIndex((h) => h.id === active.id);
    const newIdx = habits.findIndex((h) => h.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(habits, oldIdx, newIdx);
    reorderHabits(newOrder.map((h) => h.id));
  };

  const handleQuickAdd = async (title: string, category: TaskType, subtype?: TaskSubtype) => {
    await addTask({
      title,
      status: "not_started",
      priority: "medium",
      category,
      subtype,
      tags: [],
      subtasks: [],
      scheduledDate: Timestamp.fromDate(new Date()),
    });
  };

  const handleUpdateTitle = (taskId: string, title: string) => {
    updateTask(taskId, { title });
  };

  const handleTogglePriority = (taskId: string, currentPriority: TaskPriority) => {
    const cycle: TaskPriority[] = ["low", "medium", "high"];
    const idx = cycle.indexOf(currentPriority);
    const next = cycle[(idx + 1) % cycle.length];
    updateTask(taskId, { priority: next });
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    onEditModalOpen();
  };

  const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, title: string) => {
    const task = todayTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, title } : s
    );
    updateTask(taskId, { subtasks: updated });
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-background">
      <Navbar />
      <main className={`container mx-auto max-w-full px-3 sm:px-4 lg:px-[7%] py-4 sm:py-6 transition-all ${completedOpen ? "mr-80" : ""}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
                {user.displayName?.split(" ")[0]}!
              </h1>
              <p className="text-default-500 text-xs">
                {activeTasks.length} active · {completedTasks.length} done · {completedHabits}/{visibleHabits.length} habits
              </p>
            </div>
            <LiveClock fmt={timeFmt} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Tasks */}
            <Card shadow="sm">
              <CardBody className="p-2 flex flex-row items-center gap-2">
                <Target size={12} className="text-primary shrink-0" />
                <span className="text-xs font-semibold">{completedTasks.length}/{todayTasks.length}</span>
                <div className="flex gap-0.5 flex-1">
                  {(["work", "personal", "growth"] as TaskType[]).map((key) => {
                    const total = todayTasks.filter((t) => t.category === key).length;
                    const done = completedTasks.filter((t) => t.category === key).length;
                    const colors = { work: "primary", personal: "success", growth: "warning" } as const;
                    return <Progress key={key} size="sm" value={total > 0 ? (done / total) * 100 : 0} color={colors[key as keyof typeof colors]} className="flex-1" />;
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Habits */}
            <Card shadow="sm">
              <CardBody className="p-2 flex flex-row items-center gap-2">
                <Flame size={12} className="text-success shrink-0" />
                <span className="text-xs font-semibold">{completedHabits}/{visibleHabits.length}</span>
                <div className="flex gap-0.5 flex-1">
                  {(["morning", "all_day", "night"] as const).map((key) => {
                    const catH = habits.filter((h) => h.category === key);
                    const catD = catH.filter((h) => logs.some((l) => l.habitId === h.id && l.date === todayDate && l.completed)).length;
                    const colors = { morning: "warning", all_day: "primary", night: "secondary" } as const;
                    return <Progress key={key} size="sm" value={catH.length > 0 ? (catD / catH.length) * 100 : 0} color={colors[key]} className="flex-1" />;
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Pomodoro */}
            <Card shadow="sm">
              <CardBody className="p-2 flex flex-row items-center gap-2">
                <Timer size={12} className="text-warning shrink-0" />
                <span className="text-xs font-semibold">{completedPomodoros} · {completedPomodoros * 25}m</span>
                <Button color="warning" variant="flat" size="sm" className="h-5 min-w-0 px-2 text-[10px] ml-auto" onPress={() => router.push("/pomodoro")}>
                  Start
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Today's Schedule — linear timeline 6 AM to 12 AM */}
          <Card shadow="sm">
            <CardBody className="p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={12} className="text-secondary shrink-0" />
                <span className="text-xs font-semibold">Schedule</span>
                <span className="text-[10px] text-default-400">{scheduleEvents.length} events · 6 {timeFmt === "12h" ? "AM" : "00"} → 12 {timeFmt === "12h" ? "AM" : "00"}</span>
                <Button size="sm" variant="light" className="h-5 min-w-0 px-1.5 text-[10px] ml-auto" onPress={() => router.push("/schedule")}>
                  View
                </Button>
              </div>
              {(() => {
                // Linear timeline: 6:00 (=360 min) to 24:00 (=1440 min). 18-hour span.
                const START_MIN = 6 * 60;
                const END_MIN = 24 * 60;
                const SPAN = END_MIN - START_MIN; // 1080
                const now = new Date();
                const nowMins = now.getHours() * 60 + now.getMinutes();
                const nowInRange = nowMins >= START_MIN && nowMins <= END_MIN;
                const nowPct = nowInRange ? ((nowMins - START_MIN) / SPAN) * 100 : null;

                const typeColors: Record<string, string> = {
                  event: "bg-blue-500", work: "bg-purple-500", personal: "bg-green-500",
                  growth: "bg-orange-500", task: "bg-green-500", habit: "bg-purple-500",
                };

                // Hour ticks every 3 hours: 6, 9, 12, 15, 18, 21, 24
                const tickHours = [6, 9, 12, 15, 18, 21, 24];

                return (
                  <div className="relative">
                    {/* Track */}
                    <div className="relative h-5 rounded-md bg-content2/60 overflow-hidden">
                      {/* Hour grid lines */}
                      {tickHours.slice(1, -1).map((h) => {
                        const pct = ((h * 60 - START_MIN) / SPAN) * 100;
                        return (
                          <div
                            key={`grid-${h}`}
                            className="absolute top-0 bottom-0 w-px bg-default-200/60"
                            style={{ left: `${pct}%` }}
                          />
                        );
                      })}

                      {/* Events */}
                      {scheduleEvents.map((event) => {
                        const sm = parseInt(event.startTime.split(":")[0], 10) * 60 + parseInt(event.startTime.split(":")[1], 10);
                        const em = parseInt(event.endTime.split(":")[0], 10) * 60 + parseInt(event.endTime.split(":")[1], 10);
                        const clampedStart = Math.max(sm, START_MIN);
                        const clampedEnd = Math.min(em, END_MIN);
                        if (clampedEnd <= clampedStart) return null;
                        const left = ((clampedStart - START_MIN) / SPAN) * 100;
                        const width = ((clampedEnd - clampedStart) / SPAN) * 100;
                        const isPast = nowMins >= em;
                        const isCurrent = nowMins >= sm && nowMins < em;
                        const tooltipContent = (
                          <div className="px-1 py-0.5 max-w-[220px]">
                            <p className="text-xs font-semibold mb-0.5">{event.title}</p>
                            <p className="text-[10px] text-default-300">
                              {formatTimeStr(event.startTime, timeFmt)} – {formatTimeStr(event.endTime, timeFmt)} · {event.type}
                            </p>
                            {event.notes && (
                              <p className="text-[10px] text-default-200 mt-1 whitespace-pre-wrap">{event.notes}</p>
                            )}
                          </div>
                        );
                        return (
                          <Tooltip key={event.id} content={tooltipContent} placement="top" delay={150} closeDelay={0}>
                            <div
                              className={`absolute top-0.5 bottom-0.5 rounded ${typeColors[event.type] || "bg-gray-400"} ${isPast ? "opacity-40" : ""} ${isCurrent ? "ring-2 ring-primary" : ""} cursor-pointer hover:brightness-110 overflow-hidden`}
                              style={{ left: `${left}%`, width: `max(${width}%, 6px)` }}
                              onClick={() => router.push("/schedule")}
                            >
                              <span className="text-[9px] text-white font-medium px-1 truncate block leading-tight">{event.title}</span>
                            </div>
                          </Tooltip>
                        );
                      })}

                      {/* Current time marker */}
                      {nowPct !== null && (
                        <Tooltip content={<span className="text-[10px]">Now {formatTimeStr(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, timeFmt)}</span>} placement="top">
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-danger z-10"
                            style={{ left: `${nowPct}%` }}
                          >
                            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                          </div>
                        </Tooltip>
                      )}
                    </div>

                    {/* Hour labels */}
                    <div className="relative h-3.5 mt-0.5">
                      {tickHours.map((h, idx) => {
                        const pct = ((h * 60 - START_MIN) / SPAN) * 100;
                        const label = formatTimeStr(`${String(h % 24).padStart(2, "0")}:00`, timeFmt).replace(":00 ", " ").replace(":00", "");
                        const isFirst = idx === 0;
                        const isLast = idx === tickHours.length - 1;
                        return (
                          <span
                            key={`tick-${h}`}
                            className={`absolute text-[9px] text-default-400 tabular-nums whitespace-nowrap ${
                              isFirst ? "" : isLast ? "-translate-x-full" : "-translate-x-1/2"
                            }`}
                            style={{ left: `${pct}%` }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardBody>
          </Card>

          {/* Focus Tasks Row */}
          {(() => {
            // Show only explicitly-focused tasks (in selection order). When no
            // tasks are focused the row is hidden unless a focus habit exists.
            const focusItems = focusTaskIds
              .map((id) => activeTasks.find((t) => t.id === id))
              .filter(Boolean)
              .map((task) => {
                const t = task as Task;
                const type = TASK_TYPES.find((tt) => tt.key === t.category);
                return type ? { type, task: t } : null;
              })
              .filter(Boolean) as { type: typeof TASK_TYPES[number]; task: Task }[];

            // Only show a focus habit if the user explicitly picked one.
            const focusHabit = focusHabitId ? habits.find((h) => h.id === focusHabitId) : undefined;

            if (focusItems.length === 0 && !focusHabit) return null;

            return (
              <Card shadow="sm">
                <CardBody className="p-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={12} className="text-primary fill-primary shrink-0" />
                    <span className="text-xs font-semibold">Focus</span>
                    <span className="text-[10px] text-default-400">your top priorities right now</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {focusItems.map(({ type, task }) => {
                      const Icon = type.icon;
                      const nextSub = task.subtasks?.find((s) => !s.completed);
                      return (
                        <div
                          key={task.id}
                          className="p-2 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 cursor-pointer"
                          onClick={() => handleOpenEditModal(task)}
                          title="Click to edit"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Icon size={11} className={type.color} />
                            <span className="text-[10px] uppercase font-semibold text-default-500">{type.label}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <div
                              className={`w-3.5 h-3.5 mt-0.5 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
                                task.status === "completed" ? "bg-success border-success" : "border-default-300 hover:border-primary"
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id, task.status !== "completed"); }}
                            >
                              {task.status === "completed" && (
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-medium leading-tight ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
                              {task.title}
                            </span>
                          </div>
                          {nextSub && (
                            <div className="flex items-center gap-1.5 mt-1.5 pl-2 border-l-2 border-primary/30">
                              <div
                                className="w-3 h-3 rounded-sm border border-default-300 cursor-pointer hover:border-primary shrink-0"
                                onClick={(e) => { e.stopPropagation(); handleToggleSubtask(task.id, nextSub.id); }}
                              />
                              <span className="text-[11px] text-default-600 truncate">{nextSub.title}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {focusHabit && (() => {
                      const isDone = logs.some((l) => l.habitId === focusHabit.id && l.date === todayDate && l.completed);
                      return (
                        <div
                          className="p-2 rounded-lg bg-secondary/5 border border-secondary/20 hover:bg-secondary/10 cursor-pointer"
                          onClick={() => router.push("/habits")}
                          title="Go to habits"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Flame size={11} className="text-secondary" />
                            <span className="text-[10px] uppercase font-semibold text-default-500">Habit</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <div
                              className={`w-3.5 h-3.5 mt-0.5 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
                                isDone ? "bg-secondary border-secondary" : "border-default-300 hover:border-secondary"
                              }`}
                              onClick={(e) => { e.stopPropagation(); toggleHabitLog(focusHabit.id, todayDate, !isDone); }}
                            >
                              {isDone && (
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-medium leading-tight ${isDone ? "line-through text-default-400" : ""}`}>
                              {focusHabit.title}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardBody>
              </Card>
            );
          })()}

          {/* 4-Section Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TASK_TYPES.filter((t) => t.key !== "habit").map((type) => (
              <TaskSection
                key={type.key}
                type={type}
                tasks={activeTasks.filter((t) => t.category === type.key)}
                focusTaskIds={focusTaskIdSet}
                onToggle={handleToggleTask}
                onSetFocus={handleSetFocus}
                onAddSubtask={handleAddSubtask}
                onToggleSubtask={handleToggleSubtask}
                onReorderSubtasks={handleReorderSubtasks}
                onUpdateTitle={handleUpdateTitle}
                onTogglePriority={handleTogglePriority}
                onOpenEditModal={handleOpenEditModal}
                onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                onDragEnd={handleDragEnd}
                onQuickAdd={handleQuickAdd}
                sensors={sensors}
                projectsMap={projectsMap}
              />
            ))}
            <HabitSection
              habits={visibleHabits}
              logs={logs}
              todayDate={todayDate}
              focusHabitId={focusHabitId}
              onToggle={(habitId, completed) => toggleHabitLog(habitId, todayDate, completed)}
              onIncrement={(habitId, count, target) => updateHabitCount(habitId, todayDate, count, target)}
              onSetFocusHabit={(id) => setFocusHabitId(id)}
              onDragEnd={handleHabitDragEnd}
              sensors={sensors}
            />
          </div>

        </motion.div>
      </main>

      <CompletedSidebar tasks={completedTasks} isOpen={completedOpen} onToggle={() => setCompletedOpen(!completedOpen)} onUncheck={(id) => handleToggleTask(id, false)} />

      <TaskEditModal
        isOpen={isEditModalOpen}
        onOpenChange={onEditModalOpenChange}
        task={editingTask}
      />
    </div>
  );
}
