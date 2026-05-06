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
  Select,
  SelectItem,
  Chip,
  Progress,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Timer } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { usePomodoroTimer, usePomodoroSessions } from "@/hooks/use-pomodoro";
import { useTasks } from "@/hooks/use-tasks";
import { format } from "date-fns";

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
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold">Pomodoro Timer</h1>
            <p className="text-default-500 text-sm">
              {completedSessions} sessions completed today
            </p>
          </div>

          {/* Timer */}
          <Card className="max-w-md mx-auto">
            <CardBody className="p-8 text-center space-y-6">
              <div className="relative">
                <svg className="w-48 h-48 mx-auto transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-default-100"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                    className={`transition-all duration-1000 ${
                      isRunning ? "text-primary" : "text-default-300"
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-bold tabular-nums">
                    {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {!currentSessionId ? (
                  <Button
                    color="primary"
                    size="lg"
                    startContent={<Play size={20} />}
                    onPress={() => startSession(selectedTaskId || undefined)}
                    className="px-8"
                  >
                    Start
                  </Button>
                ) : (
                  <>
                    <Button
                      color={isRunning ? "warning" : "primary"}
                      size="lg"
                      isIconOnly
                      onPress={isRunning ? pauseSession : resumeSession}
                    >
                      {isRunning ? <Pause size={20} /> : <Play size={20} />}
                    </Button>
                    <Button
                      color="success"
                      size="lg"
                      isIconOnly
                      onPress={completeSession}
                    >
                      <Check size={20} />
                    </Button>
                    <Button
                      color="danger"
                      size="lg"
                      variant="flat"
                      isIconOnly
                      onPress={resetTimer}
                    >
                      <RotateCcw size={20} />
                    </Button>
                  </>
                )}
              </div>

              {/* Task Selection */}
              {!currentSessionId && activeTasks.length > 0 && (
                <Select
                  label="Link to task (optional)"
                  variant="bordered"
                  size="sm"
                  selectedKeys={selectedTaskId ? [selectedTaskId] : []}
                  onSelectionChange={(keys) => setSelectedTaskId(Array.from(keys)[0] as string)}
                >
                  {activeTasks.map((task) => (
                    <SelectItem key={task.id}>{task.title}</SelectItem>
                  ))}
                </Select>
              )}

              {/* Notes (while timer running) */}
              {currentSessionId && (
                <Textarea
                  label="Session Notes"
                  placeholder="What are you working on?"
                  value={notes}
                  onValueChange={setNotes}
                  variant="bordered"
                  minRows={3}
                />
              )}
            </CardBody>
          </Card>

          {/* Today's Sessions */}
          <Card>
            <CardHeader>
              <span className="font-semibold">Today&apos;s Sessions</span>
            </CardHeader>
            <CardBody className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-default-400 text-sm text-center py-4">
                  No sessions yet. Start your first pomodoro!
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-content2"
                  >
                    <div className={`p-1.5 rounded-full ${session.isCompleted ? "bg-success/20" : "bg-warning/20"}`}>
                      <Timer size={14} className={session.isCompleted ? "text-success" : "text-warning"} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {session.duration} min session
                        {session.isCompleted && (
                          <Chip size="sm" color="success" variant="flat" className="ml-2">
                            Done
                          </Chip>
                        )}
                      </p>
                      <p className="text-xs text-default-400">
                        {session.startedAt && format(session.startedAt.toDate(), "h:mm a")}
                        {session.notes && ` · ${session.notes.substring(0, 50)}...`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Settings Card */}
          <Card>
            <CardHeader>
              <span className="font-semibold">Timer Settings</span>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-content2">
                  <p className="text-2xl font-bold text-primary">{workDuration}</p>
                  <p className="text-xs text-default-500">Work (min)</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-content2">
                  <p className="text-2xl font-bold text-success">
                    {userProfile?.pomodoroSettings?.shortBreakDuration || 5}
                  </p>
                  <p className="text-xs text-default-500">Short Break</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-content2">
                  <p className="text-2xl font-bold text-warning">
                    {userProfile?.pomodoroSettings?.longBreakDuration || 15}
                  </p>
                  <p className="text-xs text-default-500">Long Break</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-content2">
                  <p className="text-2xl font-bold text-secondary">
                    {userProfile?.pomodoroSettings?.sessionsBeforeLongBreak || 4}
                  </p>
                  <p className="text-xs text-default-500">Before Long</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
