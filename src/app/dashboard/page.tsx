"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTodayTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { usePomodoroSessions } from "@/hooks/use-pomodoro";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
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
      { key: "project_task", label: "Project Task" },
      { key: "general_task", label: "General Task" },
      { key: "chores", label: "Chores" },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    icon: User,
    color: "text-success",
    subtypes: [
      { key: "general_task", label: "General Task" },
      { key: "project_task", label: "Project Task" },
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

const priorityColors: Record<TaskPriority, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  urgent: "danger",
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="text-center sm:text-right">
      <p className="text-2xl sm:text-3xl font-bold tabular-nums">{format(time, "hh:mm:ss a")}</p>
      <p className="text-default-500 text-xs mt-0.5">{format(time, "EEEE, MMMM d, yyyy")}</p>
    </div>
  );
}

// Sortable subtask row
function SortableSubtask({
  subtask,
  onToggle,
}: {
  subtask: Subtask;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 pl-8 py-0.5 group/sub">
      <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/sub:opacity-100 touch-none shrink-0">
        <GripVertical size={10} className="text-default-300" />
      </button>
      <div
        className={`w-3 h-3 rounded-sm border flex items-center justify-center cursor-pointer shrink-0 ${
          subtask.completed ? "bg-success/70 border-success" : "border-default-300 hover:border-primary"
        }`}
        onClick={onToggle}
      >
        {subtask.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-xs truncate ${subtask.completed ? "line-through text-default-400" : "text-default-600"}`}>
        {subtask.title}
      </span>
    </div>
  );
}

function SortableTaskItem({
  task,
  onToggle,
  onSetFocus,
  onAddSubtask,
  onToggleSubtask,
  onReorderSubtasks,
  isFocused,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onSetFocus: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  isFocused: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = subtasks.findIndex((s) => s.id === active.id);
    const newIdx = subtasks.findIndex((s) => s.id === over.id);
    onReorderSubtasks(task.id, arrayMove(subtasks, oldIdx, newIdx));
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    setAddingSubtask(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg hover:bg-content2/50 transition-colors mb-1 ${isFocused ? "bg-primary/5 border border-primary/20" : ""}`}
    >
      {/* Main task row */}
      <div className="flex items-center gap-2 p-2 group">
        <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 touch-none shrink-0">
          <GripVertical size={14} className="text-default-400" />
        </button>
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
            task.status === "completed" ? "bg-success border-success" : "border-default-300 hover:border-primary"
          }`}
          onClick={() => onToggle(task.id, task.status !== "completed")}
        >
          {task.status === "completed" && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm truncate ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
              {task.title}
            </span>
            {isFocused && <Star size={10} className="text-primary shrink-0 fill-primary" />}
          </div>
          {subtasks.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Progress size="sm" value={(completedSubtasks / subtasks.length) * 100} color="primary" className="w-16" />
              <span className="text-[10px] text-default-400">{completedSubtasks}/{subtasks.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5"
            onPress={() => setAddingSubtask(!addingSubtask)}
            title="Add subtask"
          >
            <Plus size={10} />
          </Button>
          {!isFocused && task.status !== "completed" && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5"
              onPress={() => onSetFocus(task.id)}
              title="Set as focus"
            >
              <Star size={10} />
            </Button>
          )}
          <Chip size="sm" variant="dot" color={priorityColors[task.priority]} className="hidden sm:flex h-5">
            {task.priority[0].toUpperCase()}
          </Chip>
        </div>
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <DndContext sensors={subtaskSensors} collisionDetection={closestCenter} onDragEnd={handleSubtaskDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {subtasks.map((st) => (
              <SortableSubtask
                key={st.id}
                subtask={st}
                onToggle={() => onToggleSubtask(task.id, st.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Add subtask inline */}
      {addingSubtask && (
        <div className="flex items-center gap-1.5 pl-8 pr-2 pb-2">
          <Input
            size="sm"
            variant="bordered"
            placeholder="Subtask..."
            value={newSubtaskTitle}
            onValueChange={setNewSubtaskTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
              if (e.key === "Escape") setAddingSubtask(false);
            }}
            classNames={{ inputWrapper: "border-1 h-6", input: "text-xs" }}
            autoFocus
          />
          <Button size="sm" isIconOnly variant="flat" color="primary" className="w-6 h-6 min-w-6" onPress={handleAddSubtask}>
            <Plus size={10} />
          </Button>
        </div>
      )}
    </div>
  );
}

function TaskSection({
  type,
  tasks,
  focusTaskId,
  onToggle,
  onSetFocus,
  onAddSubtask,
  onToggleSubtask,
  onReorderSubtasks,
  onDragEnd,
  onQuickAdd,
  sensors,
}: {
  type: (typeof TASK_TYPES)[number];
  tasks: Task[];
  focusTaskId?: string;
  onToggle: (id: string, completed: boolean) => void;
  onSetFocus: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onDragEnd: (event: DragEndEvent, category: TaskType) => void;
  onQuickAdd: (title: string, category: TaskType, subtype?: TaskSubtype) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtype, setNewSubtype] = useState<TaskSubtype | "">(type.subtypes[0]?.key || "");
  const Icon = type.icon;

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const focusTask = activeTasks.find((t) => t.id === focusTaskId) || activeTasks.find((t) => t.priority === "urgent" || t.priority === "high") || activeTasks[0];

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

      {focusTask && (
        <div className="mx-3 mb-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-1.5">
            <Star size={10} className="text-primary fill-primary" />
            <span className="text-[10px] font-medium text-primary uppercase">Focus</span>
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">{focusTask.title}</p>
        </div>
      )}

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

      <CardBody className="pt-0 px-2 pb-2 max-h-72 overflow-y-auto">
        {activeTasks.length === 0 ? (
          <p className="text-default-400 text-xs text-center py-4">No tasks</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, type.key)} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {activeTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onSetFocus={onSetFocus}
                  onAddSubtask={onAddSubtask}
                  onToggleSubtask={onToggleSubtask}
                  onReorderSubtasks={onReorderSubtasks}
                  isFocused={task.id === focusTask?.id}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </CardBody>
    </Card>
  );
}

function HabitSection({
  habits,
  logs,
  todayDate,
  onToggle,
  onIncrement,
  onDragEnd,
  sensors,
}: {
  habits: Habit[];
  logs: any[];
  todayDate: string;
  onToggle: (habitId: string, completed: boolean) => void;
  onIncrement: (habitId: string, count: number, target: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const completedCount = habits.filter((h) =>
    logs.some((l: any) => l.habitId === h.id && l.date === todayDate && l.completed)
  ).length;

  return (
    <Card shadow="sm" className="h-fit">
      <CardHeader className="flex justify-between items-center px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-secondary" />
          <span className="font-semibold text-sm">Habits</span>
          <Chip size="sm" variant="flat" className="h-5">{completedCount}/{habits.length}</Chip>
        </div>
      </CardHeader>
      <CardBody className="pt-0 px-2 pb-2 max-h-72 overflow-y-auto">
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
                    onToggle={() => onToggle(habit.id, !isCompleted)}
                    onIncrement={() => onIncrement(habit.id, currentCount + 1, habit.targetCount || 1)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </CardBody>
    </Card>
  );
}

function SortableHabitRow({
  habit,
  isCompleted,
  currentCount,
  onToggle,
  onIncrement,
}: {
  habit: Habit;
  isCompleted: boolean;
  currentCount: number;
  onToggle: () => void;
  onIncrement: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: habit.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isCounter = habit.type === "counter";

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded-lg hover:bg-content2 transition-colors group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none shrink-0">
        <GripVertical size={14} className="text-default-400" />
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
}: {
  tasks: Task[];
  isOpen: boolean;
  onToggle: () => void;
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
        className="absolute top-4 bg-success/10 hover:bg-success/20 border border-success/30 rounded-l-lg px-2 py-3 transition-all"
        style={{ right: isOpen ? "320px" : "0" }}
      >
        <div className="flex flex-col items-center gap-1">
          <CheckCircle2 size={16} className="text-success" />
          <span className="text-[10px] font-bold text-success">{tasks.length}</span>
          {isOpen ? <ChevronRight size={12} className="text-success" /> : <ChevronDown size={12} className="text-success rotate-90" />}
        </div>
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
                      <div key={task.id} className="flex items-center gap-2 py-1 px-2">
                        <CheckCircle2 size={12} className="text-success shrink-0" />
                        <span className="text-xs text-default-400 line-through truncate">{task.title}</span>
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks: todayTasks } = useTodayTasks();
  const { habits } = useHabits();
  const { logs } = useHabitLogs(undefined, 1);
  const { sessions } = usePomodoroSessions();
  const { addTask, updateTask, reorderTasks } = useTaskMutations();
  const { toggleHabitLog, updateHabitCount, reorderHabits } = useHabitMutations();
  const [completedOpen, setCompletedOpen] = useState(false);
  const [focusTasks, setFocusTasks] = useState<Record<TaskType, string>>({} as any);

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

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const activeTasks = todayTasks.filter((t) => t.status !== "completed");
  const completedTasks = todayTasks.filter((t) => t.status === "completed");
  const completedHabits = logs.filter((l) => l.date === todayDate && l.completed).length;
  const completedPomodoros = sessions.filter((s) => s.isCompleted).length;

  const handleToggleTask = (id: string, completed: boolean) => {
    updateTask(id, { status: completed ? "completed" : "not_started" });
  };

  const handleSetFocus = (taskId: string) => {
    const task = todayTasks.find((t) => t.id === taskId);
    if (task) setFocusTasks((prev) => ({ ...prev, [task.category]: taskId }));
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className={`container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 transition-all ${completedOpen ? "mr-80" : ""}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
                {user.displayName?.split(" ")[0]}!
              </h1>
              <p className="text-default-500 text-xs">
                {activeTasks.length} active · {completedTasks.length} done · {completedHabits}/{habits.length} habits
              </p>
            </div>
            <LiveClock />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Target, color: "text-primary", label: "Tasks", value: `${completedTasks.length}/${todayTasks.length}` },
              { icon: Flame, color: "text-success", label: "Habits", value: `${completedHabits}/${habits.length}` },
              { icon: Timer, color: "text-warning", label: "Pomodoro", value: `${completedPomodoros}` },
              { icon: Clock, color: "text-secondary", label: "Focus", value: `${completedPomodoros * 25}m` },
            ].map((stat) => (
              <Card key={stat.label} shadow="sm">
                <CardBody className="flex flex-row items-center gap-2 p-2.5">
                  <stat.icon size={14} className={`${stat.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-default-500">{stat.label}</p>
                    <p className="text-sm font-bold">{stat.value}</p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* 4-Section Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TASK_TYPES.filter((t) => t.key !== "habit").map((type) => (
              <TaskSection
                key={type.key}
                type={type}
                tasks={activeTasks.filter((t) => t.category === type.key)}
                focusTaskId={focusTasks[type.key]}
                onToggle={handleToggleTask}
                onSetFocus={handleSetFocus}
                onAddSubtask={handleAddSubtask}
                onToggleSubtask={handleToggleSubtask}
                onReorderSubtasks={handleReorderSubtasks}
                onDragEnd={handleDragEnd}
                onQuickAdd={handleQuickAdd}
                sensors={sensors}
              />
            ))}
            <HabitSection
              habits={habits}
              logs={logs}
              todayDate={todayDate}
              onToggle={(habitId, completed) => toggleHabitLog(habitId, todayDate, completed)}
              onIncrement={(habitId, count, target) => updateHabitCount(habitId, todayDate, count, target)}
              onDragEnd={handleHabitDragEnd}
              sensors={sensors}
            />
          </div>

          {/* Pomodoro */}
          <Card shadow="sm">
            <CardBody className="flex flex-row items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Timer size={16} className="text-warning" />
                <span className="text-sm font-medium">{completedPomodoros} pomodoros · {completedPomodoros * 25}m focused</span>
              </div>
              <Button color="warning" variant="flat" size="sm" onPress={() => router.push("/pomodoro")}>
                Start Timer
              </Button>
            </CardBody>
          </Card>
        </motion.div>
      </main>

      <CompletedSidebar tasks={completedTasks} isOpen={completedOpen} onToggle={() => setCompletedOpen(!completedOpen)} />
    </div>
  );
}
