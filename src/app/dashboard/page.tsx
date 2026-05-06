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
  Calendar,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTodayTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { usePomodoroSessions } from "@/hooks/use-pomodoro";
import { useSchedule } from "@/hooks/use-schedule";
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

const priorityColors: Record<TaskPriority, "default" | "primary" | "warning"> = {
  low: "default",
  medium: "primary",
  high: "warning",
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
  onUpdateTitle,
}: {
  subtask: Subtask;
  onToggle: () => void;
  onUpdateTitle: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== subtask.title) {
      onUpdateTitle(editValue.trim());
    }
    setIsEditing(false);
  };

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
      {isEditing ? (
        <input
          className="text-xs bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          autoFocus
        />
      ) : (
        <span
          className={`text-xs truncate cursor-text ${subtask.completed ? "line-through text-default-400" : "text-default-600"}`}
          onClick={() => { setIsEditing(true); setEditValue(subtask.title); }}
        >
          {subtask.title}
        </span>
      )}
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
  onUpdateTitle,
  onTogglePriority,
  onOpenEditModal,
  onUpdateSubtaskTitle,
  isFocused,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onSetFocus: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onUpdateTitle: (taskId: string, title: string) => void;
  onTogglePriority: (taskId: string, currentPriority: TaskPriority) => void;
  onOpenEditModal: (task: Task) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
  isFocused: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
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

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(task.title);
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdateTitle(task.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const priorityDotColors: Record<TaskPriority, string> = {
    low: "bg-orange-400",
    medium: "bg-blue-500",
    high: "bg-red-500",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg hover:bg-content2/50 transition-colors mb-1 cursor-grab active:cursor-grabbing touch-none ${isFocused ? "bg-primary/5 border border-primary/20" : ""}`}
      onContextMenu={(e) => { e.preventDefault(); onOpenEditModal(task); }}
    >
      {/* Main task row */}
      <div className="flex items-center gap-2 p-2 group">
        {/* Checkbox with blocked state */}
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
            task.status === "completed"
              ? "bg-success border-success"
              : task.status === "blocked"
              ? "bg-warning/30 border-warning"
              : "border-default-300 hover:border-primary"
          }`}
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.status !== "completed"); }}
        >
          {task.status === "completed" && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === "blocked" && (
            <div className="w-2 h-0.5 bg-warning rounded" />
          )}
        </div>
        <div className="flex-1 min-w-0" onClick={handleTitleClick}>
          {isEditingTitle ? (
            <Input
              size="sm"
              variant="bordered"
              value={editTitle}
              onValueChange={setEditTitle}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              classNames={{ inputWrapper: "border-1 h-6 min-h-6", input: "text-xs" }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`text-sm truncate cursor-text ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
                {task.title}
              </span>
              {isFocused && <Star size={10} className="text-primary shrink-0 fill-primary" />}
            </div>
          )}
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
          {/* Priority dot */}
          <div
            className={`w-2.5 h-2.5 rounded-full cursor-pointer ${priorityDotColors[task.priority]}`}
            onClick={(e) => { e.stopPropagation(); onTogglePriority(task.id, task.priority); }}
            title={`Priority: ${task.priority} (click to change)`}
          />
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
                onUpdateTitle={(title) => onUpdateSubtaskTitle(task.id, st.id, title)}
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
  onUpdateTitle,
  onTogglePriority,
  onOpenEditModal,
  onUpdateSubtaskTitle,
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
  onUpdateTitle: (taskId: string, title: string) => void;
  onTogglePriority: (taskId: string, currentPriority: TaskPriority) => void;
  onOpenEditModal: (task: Task) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
  onDragEnd: (event: DragEndEvent, category: TaskType) => void;
  onQuickAdd: (title: string, category: TaskType, subtype?: TaskSubtype) => void;
  sensors: ReturnType<typeof useSensors>;
}){
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtype, setNewSubtype] = useState<TaskSubtype | "">(type.subtypes[0]?.key || "");
  const Icon = type.icon;

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const focusTask = activeTasks.find((t) => t.id === focusTaskId) || activeTasks.find((t) => t.priority === "high") || activeTasks[0];

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
          {focusTask.subtasks && focusTask.subtasks.length > 0 && (() => {
            const focusSub = focusTask.subtasks.find((s) => !s.completed);
            if (!focusSub) return null;
            return (
              <div className="flex items-center gap-1.5 mt-1.5 pl-2 border-l-2 border-primary/30">
                <div
                  className="w-3 h-3 rounded-sm border border-default-300 cursor-pointer hover:border-primary shrink-0"
                  onClick={() => onToggleSubtask(focusTask.id, focusSub.id)}
                />
                <span className="text-xs text-default-600 truncate">{focusSub.title}</span>
              </div>
            );
          })()}
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
                            isFocused={task.id === focusTask?.id}
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
                          isFocused={task.id === focusTask?.id}
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
                    isFocused={task.id === focusTask?.id}
                  />
                ))
              )}
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
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const { events: scheduleEvents } = useSchedule(todayDate);
  const { addTask, updateTask, reorderTasks } = useTaskMutations();
  const { toggleHabitLog, updateHabitCount, reorderHabits } = useHabitMutations();
  const [completedOpen, setCompletedOpen] = useState(false);
  const [focusTasks, setFocusTasks] = useState<Record<TaskType, string>>({} as any);
  const [focusHabitId, setFocusHabitId] = useState<string>("");

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
    router.push("/tasks");
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
          <div className="grid grid-cols-3 gap-2">
            {/* Tasks badge with 3 progress bars */}
            <Card shadow="sm">
              <CardBody className="p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target size={14} className="text-primary shrink-0" />
                  <span className="text-[10px] text-default-500">Tasks</span>
                  <span className="text-sm font-bold ml-auto">{completedTasks.length}/{todayTasks.length}</span>
                </div>
                <div className="space-y-1">
                  {([
                    { key: "work" as TaskType, label: "W", color: "primary" },
                    { key: "personal" as TaskType, label: "P", color: "success" },
                    { key: "growth" as TaskType, label: "G", color: "warning" },
                  ] as const).map((cat) => {
                    const total = todayTasks.filter((t) => t.category === cat.key).length;
                    const done = completedTasks.filter((t) => t.category === cat.key).length;
                    return (
                      <div key={cat.key} className="flex items-center gap-1.5">
                        <span className="text-[9px] w-3 text-default-400">{cat.label}</span>
                        <Progress size="sm" value={total > 0 ? (done / total) * 100 : 0} color={cat.color as any} className="flex-1" />
                        <span className="text-[9px] text-default-400 w-6 text-right">{done}/{total}</span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Habits badge with category progress */}
            <Card shadow="sm">
              <CardBody className="p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Flame size={14} className="text-success shrink-0" />
                  <span className="text-[10px] text-default-500">Habits</span>
                  <span className="text-sm font-bold ml-auto">{completedHabits}/{habits.length}</span>
                </div>
                <div className="space-y-1">
                  {([
                    { key: "morning" as const, label: "AM", color: "warning" },
                    { key: "all_day" as const, label: "Day", color: "primary" },
                    { key: "night" as const, label: "PM", color: "secondary" },
                  ]).map((cat) => {
                    const catHabits = habits.filter((h) => h.category === cat.key);
                    const catDone = catHabits.filter((h) => logs.some((l) => l.habitId === h.id && l.date === todayDate && l.completed)).length;
                    return (
                      <div key={cat.key} className="flex items-center gap-1.5">
                        <span className="text-[9px] w-5 text-default-400">{cat.label}</span>
                        <Progress size="sm" value={catHabits.length > 0 ? (catDone / catHabits.length) * 100 : 0} color={cat.color as any} className="flex-1" />
                        <span className="text-[9px] text-default-400 w-6 text-right">{catDone}/{catHabits.length}</span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Pomodoro badge with start button */}
            <Card shadow="sm">
              <CardBody className="p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Timer size={14} className="text-warning shrink-0" />
                  <span className="text-[10px] text-default-500">Pomodoro</span>
                  <span className="text-sm font-bold ml-auto">{completedPomodoros}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-default-500">{completedPomodoros * 25}m focused</span>
                  <Button color="warning" variant="flat" size="sm" className="h-6 min-w-0 px-2 text-[10px]" onPress={() => router.push("/pomodoro")}>
                    Start
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* 4-Section Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                onUpdateTitle={handleUpdateTitle}
                onTogglePriority={handleTogglePriority}
                onOpenEditModal={handleOpenEditModal}
                onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                onDragEnd={handleDragEnd}
                onQuickAdd={handleQuickAdd}
                sensors={sensors}
              />
            ))}
            <HabitSection
              habits={habits}
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

          {/* Today's Schedule */}
          <Card shadow="sm">
            <CardHeader className="flex justify-between items-center px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-secondary" />
                <span className="font-semibold text-sm">Today&apos;s Schedule</span>
                <Chip size="sm" variant="flat" className="h-5">{scheduleEvents.length}</Chip>
              </div>
              <Button size="sm" variant="light" onPress={() => router.push("/schedule")}>
                View All
              </Button>
            </CardHeader>
            <CardBody className="pt-0 px-3 pb-3">
              {scheduleEvents.length === 0 ? (
                <p className="text-default-400 text-xs text-center py-3">No events scheduled</p>
              ) : (
                <div className="space-y-1.5">
                  {scheduleEvents.map((event) => {
                    const now = format(new Date(), "HH:mm");
                    const isPast = event.endTime <= now;
                    const isCurrent = event.startTime <= now && event.endTime > now;
                    const typeColors: Record<string, string> = {
                      meeting: "bg-blue-500",
                      task: "bg-green-500",
                      habit: "bg-purple-500",
                      block: "bg-orange-500",
                      break: "bg-gray-400",
                    };
                    return (
                      <div
                        key={event.id}
                        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                          isCurrent ? "bg-primary/10 border border-primary/20" : isPast ? "opacity-50" : "hover:bg-content2"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${typeColors[event.type] || "bg-gray-400"}`} />
                        <span className="text-xs text-default-500 w-20 shrink-0">
                          {event.startTime} - {event.endTime}
                        </span>
                        <span className={`text-sm flex-1 truncate ${isPast ? "line-through text-default-400" : "font-medium"}`}>
                          {event.title}
                        </span>
                        {isCurrent && <Chip size="sm" color="primary" variant="flat" className="h-4 text-[9px]">Now</Chip>}
                        {isPast && <CheckCircle2 size={12} className="text-success shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </main>

      <CompletedSidebar tasks={completedTasks} isOpen={completedOpen} onToggle={() => setCompletedOpen(!completedOpen)} />
    </div>
  );
}
