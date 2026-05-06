"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Textarea,
  Chip,
  Checkbox,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Timer, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { usePomodoroTimer, usePomodoroSessions } from "@/hooks/use-pomodoro";
import { useTasks } from "@/hooks/use-tasks";
import { useHabits } from "@/hooks/use-habits";
import { format } from "date-fns";

function LiveTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-sm text-default-500 tabular-nums">{format(time, "hh:mm a")}</span>;
}

export default function PomodoroPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const workDuration = userProfile?.pomodoroSettings?.workDuration || 25;
  const {
    timeLeft,
    isRunning,
    currentSessionId,
    notes,
    setNotes,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    resetTimer,
  } = usePomodoroTimer(workDuration);
  const { sessions } = usePomodoroSessions();
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

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

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100;
  const completedSessions = sessions.filter((s) => s.isCompleted).length;
  const activeTasks = tasks.filter((t) => t.status !== "completed");

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const toggleHabit = (id: string) => {
    setSelectedHabitIds((prev) => prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]);
  };

  const handleStart = () => {
    startSession(
      selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
      selectedHabitIds.length > 0 ? selectedHabitIds : undefined
    );
  };

  // Focus mode: when timer is running, show minimal UI
  if (currentSessionId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
          {/* Current time */}
          <div className="flex items-center gap-2 mb-8">
            <Clock size={14} className="text-default-400" />
            <LiveTime />
          </div>

          {/* Timer */}
          <div className="relative mb-8">
            <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none" className="text-default-100" />
              <circle
                cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                className="text-primary transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-bold tabular-nums">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              color={isRunning ? "warning" : "primary"}
              size="lg"
              isIconOnly
              onPress={isRunning ? pauseSession : resumeSession}
            >
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button color="success" size="lg" isIconOnly onPress={completeSession}>
              <Check size={20} />
            </Button>
            <Button color="danger" size="lg" variant="flat" isIconOnly onPress={resetTimer}>
              <RotateCcw size={20} />
            </Button>
          </div>

          {/* Linked tasks in focus */}
          {selectedTaskIds.length > 0 && (
            <div className="w-full mb-4">
              <p className="text-[10px] uppercase text-default-400 font-semibold mb-1.5">Focus Tasks</p>
              <div className="space-y-1">
                {activeTasks.filter((t) => selectedTaskIds.includes(t.id)).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked habits in focus */}
          {selectedHabitIds.length > 0 && (
            <div className="w-full mb-4">
              <p className="text-[10px] uppercase text-default-400 font-semibold mb-1.5">Focus Habits</p>
              <div className="space-y-1">
                {habits.filter((h) => selectedHabitIds.includes(h.id)).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/5 border border-secondary/20">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-sm font-medium truncate">{h.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="w-full">
            <Textarea
              placeholder="Session notes..."
              value={notes}
              onValueChange={setNotes}
              variant="bordered"
              minRows={3}
              classNames={{ inputWrapper: "border-1" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Normal mode: setup screen
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold">Pomodoro Timer</h1>
            <p className="text-default-500 text-sm">{completedSessions} sessions today</p>
          </div>

          {/* Timer preview */}
          <Card className="max-w-sm mx-auto">
            <CardBody className="p-6 text-center space-y-4">
              <div className="relative">
                <svg className="w-40 h-40 mx-auto transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="none" className="text-default-100" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold tabular-nums">{workDuration}:00</span>
                </div>
              </div>
              <Button color="primary" size="lg" startContent={<Play size={20} />} onPress={handleStart} className="px-8">
                Start Focus
              </Button>
            </CardBody>
          </Card>

          {/* Link tasks */}
          {activeTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <span className="text-sm font-semibold">Link Tasks</span>
                {selectedTaskIds.length > 0 && <Chip size="sm" variant="flat" className="ml-2 h-5">{selectedTaskIds.length}</Chip>}
              </CardHeader>
              <CardBody className="pt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedTaskIds.includes(task.id) ? "bg-primary/10" : "hover:bg-content2"
                    }`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <Checkbox size="sm" isSelected={selectedTaskIds.includes(task.id)} onValueChange={() => toggleTask(task.id)} />
                    <span className="text-sm truncate">{task.title}</span>
                    <Chip size="sm" variant="flat" className="h-4 ml-auto text-[9px]">{task.category}</Chip>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Link habits */}
          {habits.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <span className="text-sm font-semibold">Link Habits</span>
                {selectedHabitIds.length > 0 && <Chip size="sm" variant="flat" className="ml-2 h-5">{selectedHabitIds.length}</Chip>}
              </CardHeader>
              <CardBody className="pt-1 space-y-0.5 max-h-36 overflow-y-auto">
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedHabitIds.includes(habit.id) ? "bg-secondary/10" : "hover:bg-content2"
                    }`}
                    onClick={() => toggleHabit(habit.id)}
                  >
                    <Checkbox size="sm" isSelected={selectedHabitIds.includes(habit.id)} onValueChange={() => toggleHabit(habit.id)} />
                    <span className="text-sm truncate">{habit.title}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Today's Sessions */}
          <Card>
            <CardHeader>
              <span className="text-sm font-semibold">Today&apos;s Sessions</span>
            </CardHeader>
            <CardBody className="space-y-1.5">
              {sessions.length === 0 ? (
                <p className="text-default-400 text-sm text-center py-4">No sessions yet</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-2 p-2 rounded-lg bg-content2">
                    <div className={`p-1 rounded-full ${session.isCompleted ? "bg-success/20" : "bg-warning/20"}`}>
                      <Timer size={12} className={session.isCompleted ? "text-success" : "text-warning"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {session.duration}min
                        {session.isCompleted && <Chip size="sm" color="success" variant="flat" className="ml-1 h-4 text-[9px]">Done</Chip>}
                      </p>
                      <p className="text-[10px] text-default-400 truncate">
                        {session.startedAt && format(session.startedAt.toDate(), "h:mm a")}
                        {session.notes && ` · ${session.notes.substring(0, 40)}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

