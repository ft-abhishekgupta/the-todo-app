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
import { motion } from "framer-motion";
import {
  Plus,
  Clock,
  Target,
  Flame,
  Timer,
  Calendar,
  GripVertical,
  Droplets,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTodayTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { usePomodoroSessions } from "@/hooks/use-pomodoro";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Task, TaskPriority, TaskCategory, Habit } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center sm:text-right">
      <p className="text-2xl sm:text-4xl font-bold tabular-nums">
        {format(time, "hh:mm:ss a")}
      </p>
      <p className="text-default-500 text-xs sm:text-sm mt-1">
        {format(time, "EEEE, MMMM d, yyyy")}
      </p>
    </div>
  );
}

const priorityColors: Record<TaskPriority, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  urgent: "danger",
};

function SortableTaskItem({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-content2 transition-colors group"
    >
      <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 touch-none">
        <GripVertical size={14} className="text-default-400" />
      </button>
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
          task.status === "completed" ? "bg-success border-success" : "border-default-300"
        }`}
        onClick={() => onToggle(task.id, task.status !== "completed")}
      >
        {task.status === "completed" && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm flex-1 truncate ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
        {task.title}
      </span>
      <Chip size="sm" variant="dot" color={priorityColors[task.priority]} className="hidden sm:flex">
        {task.priority}
      </Chip>
    </div>
  );
}

function SortableHabitItem({
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: habit.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCounter = habit.type === "counter";
  const progress = isCounter && habit.targetCount ? (currentCount / habit.targetCount) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-content2 transition-colors group"
    >
      <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 touch-none">
        <GripVertical size={14} className="text-default-400" />
      </button>
      {isCounter ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-sm truncate ${isCompleted ? "text-default-400" : ""}`}>
            {habit.title}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Progress
              size="sm"
              value={progress}
              color={isCompleted ? "success" : "primary"}
              className="w-16 sm:w-24"
            />
            <Button
              size="sm"
              isIconOnly
              variant="flat"
              color={isCompleted ? "success" : "primary"}
              className="w-6 h-6 min-w-6"
              onPress={onIncrement}
            >
              <Plus size={12} />
            </Button>
            <span className="text-xs text-default-500 w-12 text-right">
              {currentCount}/{habit.targetCount}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
              isCompleted ? "bg-success border-success" : "border-default-300"
            }`}
            onClick={onToggle}
          >
            {isCompleted && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm flex-1 truncate ${isCompleted ? "text-default-400" : ""}`}>
            {habit.title}
          </span>
          {habit.streak > 0 && (
            <Chip size="sm" color="warning" variant="flat" startContent={<Flame size={10} />}>
              {habit.streak}
            </Chip>
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks();
  const { habits, loading: habitsLoading } = useHabits();
  const { logs } = useHabitLogs(undefined, 1);
  const { sessions } = usePomodoroSessions();
  const { addTask, updateTask, reorderTasks } = useTaskMutations();
  const { toggleHabitLog, updateHabitCount, reorderHabits } = useHabitMutations();
  const [quickTask, setQuickTask] = useState("");
  const [quickTaskCategory, setQuickTaskCategory] = useState<TaskCategory>("personal_work");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  const completedToday = todayTasks.filter((t) => t.status === "completed").length;
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const completedHabits = logs.filter((l) => l.date === todayDate && l.completed).length;
  const completedPomodoros = sessions.filter((s) => s.isCompleted).length;

  // Focus tasks per section
  const taskFocus = todayTasks.find(
    (t) => t.status !== "completed" && (t.priority === "urgent" || t.priority === "high")
  ) || todayTasks.find((t) => t.status !== "completed");

  const handleQuickAdd = async () => {
    if (!quickTask.trim()) return;
    await addTask({
      title: quickTask,
      status: "not_started",
      priority: "medium",
      category: quickTaskCategory,
      tags: [],
      subtasks: [],
      scheduledDate: Timestamp.fromDate(new Date()),
    });
    setQuickTask("");
  };

  const handleTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = todayTasks.findIndex((t) => t.id === active.id);
    const newIndex = todayTasks.findIndex((t) => t.id === over.id);
    const newOrder = arrayMove(todayTasks, oldIndex, newIndex);
    reorderTasks(newOrder.map((t) => t.id));
  };

  const handleHabitDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    const newOrder = arrayMove(habits, oldIndex, newIndex);
    reorderHabits(newOrder.map((h) => h.id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 sm:space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
                {user.displayName?.split(" ")[0]}!
              </h1>
              <p className="text-default-500 text-sm">Here&apos;s your day at a glance</p>
            </div>
            <LiveClock />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <Card shadow="sm">
              <CardBody className="flex flex-row items-center gap-2 sm:gap-3 p-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Target size={16} className="text-primary sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-default-500">Tasks</p>
                  <p className="text-lg sm:text-xl font-bold">{completedToday}/{todayTasks.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card shadow="sm">
              <CardBody className="flex flex-row items-center gap-2 sm:gap-3 p-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
                  <Flame size={16} className="text-success sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-default-500">Habits</p>
                  <p className="text-lg sm:text-xl font-bold">{completedHabits}/{habits.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card shadow="sm">
              <CardBody className="flex flex-row items-center gap-2 sm:gap-3 p-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10">
                  <Timer size={16} className="text-warning sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-default-500">Pomodoros</p>
                  <p className="text-lg sm:text-xl font-bold">{completedPomodoros}</p>
                </div>
              </CardBody>
            </Card>
            <Card shadow="sm">
              <CardBody className="flex flex-row items-center gap-2 sm:gap-3 p-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-secondary/10">
                  <Calendar size={16} className="text-secondary sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-default-500">Progress</p>
                  <p className="text-lg sm:text-xl font-bold">
                    {todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0}%
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Quick Add */}
          <Card shadow="sm">
            <CardBody className="flex flex-col sm:flex-row gap-2 p-3">
              <Input
                placeholder="Quick add a task..."
                value={quickTask}
                onValueChange={setQuickTask}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                startContent={<Plus size={16} className="text-default-400" />}
                variant="bordered"
                size="sm"
                classNames={{ inputWrapper: "border-1" }}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select
                  size="sm"
                  variant="bordered"
                  className="w-36 sm:w-40"
                  selectedKeys={[quickTaskCategory]}
                  onSelectionChange={(keys) => setQuickTaskCategory(Array.from(keys)[0] as TaskCategory)}
                  aria-label="Category"
                >
                  <SelectItem key="work_projects">Work</SelectItem>
                  <SelectItem key="personal_projects">Personal</SelectItem>
                  <SelectItem key="personal_work">Personal Work</SelectItem>
                  <SelectItem key="chores">Chores</SelectItem>
                </Select>
                <Button color="primary" size="sm" isIconOnly onPress={handleQuickAdd}>
                  <Plus size={16} />
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Main Content - Two Sections */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Tasks Section */}
            <Card shadow="sm">
              <CardHeader className="flex justify-between items-center px-4 py-3">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-primary" />
                  <span className="font-semibold text-sm">Today&apos;s Tasks</span>
                </div>
                <Button size="sm" variant="light" color="primary" onPress={() => router.push("/tasks")}>
                  View All
                </Button>
              </CardHeader>
              {/* Focus Task */}
              {taskFocus && (
                <div className="mx-4 mb-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-medium text-primary">Focus</span>
                  </div>
                  <p className="text-sm font-medium mt-1 truncate">{taskFocus.title}</p>
                </div>
              )}
              <CardBody className="pt-0 px-2 pb-3 max-h-80 overflow-y-auto">
                {todayTasks.length === 0 ? (
                  <p className="text-default-400 text-sm text-center py-6">No tasks for today</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                    <SortableContext items={todayTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {todayTasks.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          onToggle={(id, completed) =>
                            updateTask(id, { status: completed ? "completed" : "not_started" })
                          }
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </CardBody>
            </Card>

            {/* Habits Section */}
            <Card shadow="sm">
              <CardHeader className="flex justify-between items-center px-4 py-3">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-success" />
                  <span className="font-semibold text-sm">Habits</span>
                </div>
                <Button size="sm" variant="light" color="primary" onPress={() => router.push("/habits")}>
                  View All
                </Button>
              </CardHeader>
              <CardBody className="pt-0 px-2 pb-3 max-h-80 overflow-y-auto">
                {habits.length === 0 ? (
                  <p className="text-default-400 text-sm text-center py-6">No habits yet</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHabitDragEnd}>
                    <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                      {habits.map((habit) => {
                        const log = logs.find((l) => l.habitId === habit.id && l.date === todayDate);
                        const isCompleted = log?.completed || false;
                        const currentCount = log?.count || 0;
                        return (
                          <SortableHabitItem
                            key={habit.id}
                            habit={habit}
                            isCompleted={isCompleted}
                            currentCount={currentCount}
                            onToggle={() => toggleHabitLog(habit.id, todayDate, !isCompleted)}
                            onIncrement={() =>
                              updateHabitCount(
                                habit.id,
                                todayDate,
                                currentCount + 1,
                                habit.targetCount || 1
                              )
                            }
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Pomodoro Quick Access */}
          <Card shadow="sm">
            <CardBody className="flex flex-row items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Timer size={20} className="text-warning" />
                </div>
                <div>
                  <p className="font-medium text-sm">{completedPomodoros} pomodoros today</p>
                  <p className="text-default-400 text-xs">{completedPomodoros * 25} min focused</p>
                </div>
              </div>
              <Button color="warning" variant="flat" size="sm" onPress={() => router.push("/pomodoro")}>
                Start Timer
              </Button>
            </CardBody>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
