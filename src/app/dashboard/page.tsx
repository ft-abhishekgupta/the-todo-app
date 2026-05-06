"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Input, Button, Chip, Progress } from "@nextui-org/react";
import { motion } from "framer-motion";
import { Plus, Clock, Target, Flame, Timer, Calendar } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTodayTasks } from "@/hooks/use-tasks";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { usePomodoroSessions } from "@/hooks/use-pomodoro";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Task, TaskPriority } from "@/types";

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <p className="text-4xl font-bold tabular-nums">
        {format(time, "hh:mm:ss a")}
      </p>
      <p className="text-default-500 text-sm mt-1">
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

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks();
  const { habits, loading: habitsLoading } = useHabits();
  const { logs } = useHabitLogs(undefined, 1);
  const { sessions } = usePomodoroSessions();
  const { addTask } = useTaskMutations();
  const { toggleHabitLog } = useHabitMutations();
  const [quickTask, setQuickTask] = useState("");

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
  const focusTask = todayTasks.find(
    (t) => t.status !== "completed" && (t.priority === "urgent" || t.priority === "high")
  ) || todayTasks.find((t) => t.status !== "completed");

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const completedHabits = logs.filter(
    (l) => l.date === todayDate && l.completed
  ).length;

  const completedPomodoros = sessions.filter((s) => s.isCompleted).length;

  const handleQuickAdd = async () => {
    if (!quickTask.trim()) return;
    await addTask({
      title: quickTask,
      status: "not_started",
      priority: "medium",
      category: "personal_work",
      tags: [],
      subtasks: [],
      scheduledDate: Timestamp.fromDate(new Date()),
    });
    setQuickTask("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
                {user.displayName?.split(" ")[0]}!
              </h1>
              <p className="text-default-500">Here&apos;s your productivity overview</p>
            </div>
            <LiveClock />
          </div>

          {/* Quick Add */}
          <Card>
            <CardBody className="flex flex-row gap-2">
              <Input
                placeholder="Quick add a task for today..."
                value={quickTask}
                onValueChange={setQuickTask}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                startContent={<Plus size={16} className="text-default-400" />}
                variant="bordered"
                classNames={{ inputWrapper: "border-1" }}
              />
              <Button color="primary" isIconOnly onPress={handleQuickAdd}>
                <Plus size={18} />
              </Button>
            </CardBody>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Tasks Today</p>
                  <p className="text-xl font-bold">
                    {completedToday}/{todayTasks.length}
                  </p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-success/10">
                  <Flame size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Habits</p>
                  <p className="text-xl font-bold">
                    {completedHabits}/{habits.length}
                  </p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Timer size={20} className="text-warning" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Pomodoros</p>
                  <p className="text-xl font-bold">{completedPomodoros}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Calendar size={20} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Progress</p>
                  <p className="text-xl font-bold">
                    {todayTasks.length > 0
                      ? Math.round((completedToday / todayTasks.length) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Focus Task */}
            {focusTask && (
              <Card className="border-2 border-primary/20">
                <CardHeader className="flex gap-2">
                  <Target size={18} className="text-primary" />
                  <span className="font-semibold text-sm">Focus Task</span>
                </CardHeader>
                <CardBody className="pt-0">
                  <h3 className="text-lg font-medium">{focusTask.title}</h3>
                  {focusTask.description && (
                    <p className="text-default-500 text-sm mt-1">
                      {focusTask.description}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Chip size="sm" color={priorityColors[focusTask.priority]} variant="flat">
                      {focusTask.priority}
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {focusTask.category.replace("_", " ")}
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Today's Tasks */}
            <Card>
              <CardHeader className="flex justify-between">
                <span className="font-semibold text-sm">Today&apos;s Tasks</span>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => router.push("/tasks")}
                >
                  View All
                </Button>
              </CardHeader>
              <CardBody className="pt-0 space-y-2 max-h-64 overflow-y-auto">
                {todayTasks.length === 0 ? (
                  <p className="text-default-400 text-sm text-center py-4">
                    No tasks scheduled for today
                  </p>
                ) : (
                  todayTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-content2 transition-colors"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          task.status === "completed"
                            ? "bg-success"
                            : task.priority === "urgent"
                            ? "bg-danger"
                            : "bg-default-300"
                        }`}
                      />
                      <span
                        className={`text-sm flex-1 ${
                          task.status === "completed"
                            ? "line-through text-default-400"
                            : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      <Chip size="sm" variant="dot" color={priorityColors[task.priority]}>
                        {task.priority}
                      </Chip>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            {/* Habit Checklist */}
            <Card>
              <CardHeader className="flex justify-between">
                <span className="font-semibold text-sm">Habit Checklist</span>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => router.push("/habits")}
                >
                  View All
                </Button>
              </CardHeader>
              <CardBody className="pt-0 space-y-2 max-h-64 overflow-y-auto">
                {habits.length === 0 ? (
                  <p className="text-default-400 text-sm text-center py-4">
                    No habits yet. Create one to get started!
                  </p>
                ) : (
                  habits.slice(0, 6).map((habit) => {
                    const isCompleted = logs.some(
                      (l) => l.habitId === habit.id && l.date === todayDate && l.completed
                    );
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-content2 transition-colors cursor-pointer"
                        onClick={() => toggleHabitLog(habit.id, todayDate, !isCompleted)}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isCompleted
                              ? "bg-success border-success"
                              : "border-default-300"
                          }`}
                        >
                          {isCompleted && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm flex-1 ${isCompleted ? "text-default-400" : ""}`}>
                          {habit.title}
                        </span>
                        {habit.streak > 0 && (
                          <Chip size="sm" color="warning" variant="flat" startContent={<Flame size={12} />}>
                            {habit.streak}
                          </Chip>
                        )}
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>

            {/* Pomodoro Quick Stats */}
            <Card>
              <CardHeader className="flex justify-between">
                <span className="font-semibold text-sm">Pomodoro Today</span>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => router.push("/pomodoro")}
                >
                  Start Timer
                </Button>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">
                      {completedPomodoros}
                    </p>
                    <p className="text-default-500 text-sm">sessions completed</p>
                    <p className="text-default-400 text-xs mt-1">
                      {completedPomodoros * 25} minutes focused
                    </p>
                  </div>
                </div>
                {todayTasks.length > 0 && (
                  <Progress
                    label="Daily Progress"
                    value={todayTasks.length > 0 ? (completedToday / todayTasks.length) * 100 : 0}
                    color="primary"
                    showValueLabel
                    className="mt-2"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
