"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Textarea,
  Chip,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
  Tabs,
  Tab,
  Input,
  useDisclosure,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Timer, Clock, ChevronDown, ChevronRight, Trash2, FileText, X, SkipForward, Plus, Coffee, Brain, Flame, BarChart3 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { usePomodoroTimer, usePomodoroSessions, usePomodoroMutations } from "@/hooks/use-pomodoro";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitMutations } from "@/hooks/use-habits";
import { format, differenceInSeconds } from "date-fns";
import { Task, PomodoroSession, PomodoroMode } from "@/types";
import { dateFnsTimeFormat } from "@/lib/time";

function LiveTime({ fmt }: { fmt: "12h" | "24h" }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-sm text-default-500 tabular-nums">{format(time, dateFnsTimeFormat(fmt))}</span>;
}

const MODE_META: Record<PomodoroMode, { label: string; short: string; color: "primary" | "success" | "secondary"; icon: React.ReactNode }> = {
  focus: { label: "Focus", short: "Focus", color: "primary", icon: <Brain size={14} /> },
  short_break: { label: "Short Break", short: "Break", color: "success", icon: <Coffee size={14} /> },
  long_break: { label: "Long Break", short: "Long Break", color: "secondary", icon: <Coffee size={14} /> },
};

const PRESETS: number[] = [15, 25, 45, 60, 90];

const AUTO_NEXT_KEY = "pomodoro:autoStartNext";

export default function PomodoroPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const settings = {
    workDuration: userProfile?.pomodoroSettings?.workDuration || 25,
    shortBreakDuration: userProfile?.pomodoroSettings?.shortBreakDuration || 5,
    longBreakDuration: userProfile?.pomodoroSettings?.longBreakDuration || 15,
    sessionsBeforeLongBreak: userProfile?.pomodoroSettings?.sessionsBeforeLongBreak || 4,
  };
  const timeFmt = userProfile?.timeFormat || "12h";

  const {
    mode,
    setMode,
    activeDuration,
    timeLeft,
    isRunning,
    currentSessionId,
    notes,
    setNotes,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    extendSession,
    skipSession,
    resetTimer,
  } = usePomodoroTimer(settings);

  const { sessions } = usePomodoroSessions();
  const { deleteSession } = usePomodoroMutations();
  const { tasks } = useTasks();
  const { updateTask } = useTaskMutations();
  const { habits } = useHabits();
  const { toggleHabitLog } = useHabitMutations();

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [viewSession, setViewSession] = useState<PomodoroSession | null>(null);
  const [customDuration, setCustomDuration] = useState<string>("");
  const [autoStartNext, setAutoStartNext] = useState(false);
  const { isOpen: isSessionOpen, onOpen: onSessionOpen, onOpenChange: onSessionOpenChange } = useDisclosure();

  const originalTitleRef = useRef<string>("");
  const lastCompletedSessionIdRef = useRef<string | null>(null);

  // Persist auto-start preference.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_NEXT_KEY);
      if (saved === "true") setAutoStartNext(true);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(AUTO_NEXT_KEY, autoStartNext ? "true" : "false"); } catch {}
  }, [autoStartNext]);

  // Tab title countdown
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!originalTitleRef.current) originalTitleRef.current = document.title;
    if (currentSessionId) {
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      document.title = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} · ${MODE_META[mode].short}`;
    } else if (originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
    return () => {
      if (originalTitleRef.current && !currentSessionId) document.title = originalTitleRef.current;
    };
  }, [timeLeft, currentSessionId, mode]);

  // Auto-start next session after a focus completion.
  // Watch for transitions from running -> not running with a fresh completed-focus session in today's list.
  useEffect(() => {
    if (currentSessionId) return;
    if (!autoStartNext) return;
    // Find the most recently completed focus session today.
    const lastCompletedFocus = sessions.find(
      (s) => (s.mode ?? "focus") === "focus" && s.isCompleted && !s.skipped
    );
    if (!lastCompletedFocus) return;
    if (lastCompletedSessionIdRef.current === lastCompletedFocus.id) return;
    // Only trigger if this is a new completion since last check (skip on initial mount).
    if (lastCompletedSessionIdRef.current === null) {
      lastCompletedSessionIdRef.current = lastCompletedFocus.id;
      return;
    }
    lastCompletedSessionIdRef.current = lastCompletedFocus.id;

    const completedFocusToday = sessions.filter(
      (s) => (s.mode ?? "focus") === "focus" && s.isCompleted && !s.skipped
    ).length;
    const nextMode: PomodoroMode = completedFocusToday > 0 && completedFocusToday % settings.sessionsBeforeLongBreak === 0
      ? "long_break"
      : "short_break";
    const dur = nextMode === "long_break" ? settings.longBreakDuration : settings.shortBreakDuration;
    setMode(nextMode);
    startSession({ mode: nextMode, durationMin: dur });
  }, [sessions, autoStartNext, currentSessionId, settings.sessionsBeforeLongBreak, settings.longBreakDuration, settings.shortBreakDuration, setMode, startSession]);

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
  const totalSeconds = activeDuration * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
  const activeTasks = tasks.filter((t) => t.status !== "completed");

  // Stats (today)
  const focusSessionsToday = sessions.filter((s) => (s.mode ?? "focus") === "focus" && s.isCompleted && !s.skipped);
  const breakSessionsToday = sessions.filter((s) => (s.mode ?? "focus") !== "focus" && s.isCompleted && !s.skipped);
  const focusSecondsToday = focusSessionsToday.reduce((acc, s) => acc + (s.actualDurationSeconds ?? s.duration * 60), 0);
  const breakSecondsToday = breakSessionsToday.reduce((acc, s) => acc + (s.actualDurationSeconds ?? s.duration * 60), 0);
  const focusMinutesToday = Math.round(focusSecondsToday / 60);
  const breakMinutesToday = Math.round(breakSecondsToday / 60);
  const sessionsUntilLongBreak = settings.sessionsBeforeLongBreak - (focusSessionsToday.length % settings.sessionsBeforeLongBreak);

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };
  const toggleHabit = (id: string) => {
    setSelectedHabitIds((prev) => prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]);
  };
  const toggleExpandTask = (id: string) => {
    setExpandedTasks((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const handleToggleTaskComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "not_started" : "completed";
    await updateTask(task.id, { status: newStatus });
  };
  const handleToggleSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await updateTask(task.id, { subtasks: updatedSubtasks });
  };
  const handleToggleHabitComplete = async (habitId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    await toggleHabitLog(habitId, today, true);
  };

  const handleStart = () => {
    const parsed = customDuration ? parseInt(customDuration, 10) : NaN;
    const customMin = !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
    const onlyForFocus = mode === "focus";
    startSession({
      mode,
      durationMin: onlyForFocus ? customMin : undefined,
      taskIds: mode === "focus" && selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
      habitIds: mode === "focus" && selectedHabitIds.length > 0 ? selectedHabitIds : undefined,
    });
  };

  const previewDuration = (() => {
    if (mode !== "focus") return mode === "short_break" ? settings.shortBreakDuration : settings.longBreakDuration;
    const parsed = customDuration ? parseInt(customDuration, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed > 0) return Math.min(180, parsed);
    return settings.workDuration;
  })();

  const modeMeta = MODE_META[mode];

  // ----- Focus mode (running) -----
  if (currentSessionId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
          {/* Current time + mode badge */}
          <div className="flex items-center gap-3 mb-6">
            <Clock size={14} className="text-default-400" />
            <LiveTime fmt={timeFmt} />
            <Chip size="sm" color={modeMeta.color} variant="flat" startContent={modeMeta.icon}>
              {modeMeta.label}
            </Chip>
          </div>

          {/* Timer */}
          <div className="relative mb-8">
            <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none" className="text-default-100" />
              <circle
                cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                className={`transition-all duration-1000 ${
                  modeMeta.color === "primary" ? "text-primary"
                  : modeMeta.color === "success" ? "text-success"
                  : "text-secondary"
                }`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-bold tabular-nums">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-default-400 mt-1">
                of {activeDuration} min
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
            <Button
              color={isRunning ? "warning" : modeMeta.color}
              size="lg"
              isIconOnly
              onPress={isRunning ? pauseSession : resumeSession}
              aria-label={isRunning ? "Pause" : "Resume"}
            >
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button color="success" size="lg" isIconOnly onPress={completeSession} aria-label="Complete">
              <Check size={20} />
            </Button>
            <Button size="lg" variant="flat" isIconOnly onPress={() => extendSession(5)} title="Add 5 minutes" aria-label="Add 5 minutes">
              <Plus size={20} />
            </Button>
            <Button size="lg" variant="flat" isIconOnly onPress={skipSession} title="Skip" aria-label="Skip">
              <SkipForward size={20} />
            </Button>
            <Button color="danger" size="lg" variant="flat" isIconOnly onPress={resetTimer} title="Cancel & discard" aria-label="Cancel">
              <RotateCcw size={20} />
            </Button>
          </div>
          <p className="text-[10px] text-default-400 mb-8">
            +5 min &middot; Skip saves as skipped &middot; Reset discards
          </p>

          {/* Linked tasks (focus mode only) */}
          {mode === "focus" && selectedTaskIds.length > 0 && (
            <div className="w-full mb-4">
              <p className="text-[10px] uppercase text-default-400 font-semibold mb-1.5">Focus Tasks</p>
              <div className="space-y-1">
                {tasks.filter((t) => selectedTaskIds.includes(t.id)).map((t) => (
                  <div key={t.id}>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <Checkbox
                        size="sm"
                        isSelected={t.status === "completed"}
                        onValueChange={() => handleToggleTaskComplete(t)}
                        lineThrough
                      />
                      <span className={`text-sm font-medium truncate flex-1 ${t.status === "completed" ? "line-through text-default-400" : ""}`}>{t.title}</span>
                      {t.subtasks.length > 0 && (
                        <Button size="sm" isIconOnly variant="light" className="w-5 h-5 min-w-5" onPress={() => toggleExpandTask(t.id)}>
                          {expandedTasks.includes(t.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </Button>
                      )}
                    </div>
                    {expandedTasks.includes(t.id) && t.subtasks.length > 0 && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {t.subtasks.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 p-1.5 rounded bg-content2">
                            <Checkbox
                              size="sm"
                              isSelected={sub.completed}
                              onValueChange={() => handleToggleSubtask(t, sub.id)}
                              lineThrough
                            />
                            <span className={`text-xs truncate ${sub.completed ? "line-through text-default-400" : ""}`}>{sub.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked habits (focus mode only) */}
          {mode === "focus" && selectedHabitIds.length > 0 && (
            <div className="w-full mb-4">
              <p className="text-[10px] uppercase text-default-400 font-semibold mb-1.5">Focus Habits</p>
              <div className="space-y-1">
                {habits.filter((h) => selectedHabitIds.includes(h.id)).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/5 border border-secondary/20">
                    <Checkbox size="sm" onValueChange={() => handleToggleHabitComplete(h.id)} />
                    <span className="text-sm font-medium truncate">{h.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="w-full">
            <Textarea
              placeholder={mode === "focus" ? "Session notes..." : "Break notes (optional)..."}
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

  // ----- Setup screen -----
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-4 lg:px-[7%] py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header + stats */}
          <div className="text-center">
            <h1 className="text-2xl font-bold">Pomodoro Timer</h1>
            <p className="text-default-500 text-sm">
              {focusSessionsToday.length} focus {focusSessionsToday.length === 1 ? "session" : "sessions"} today
            </p>
          </div>

          {/* Stats card */}
          <Card className="max-w-2xl mx-auto">
            <CardBody className="p-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-default-400 text-[10px] uppercase font-semibold mb-1">
                    <Brain size={11} /> Focus
                  </div>
                  <p className="text-lg font-bold tabular-nums">{focusMinutesToday}<span className="text-xs font-normal text-default-500">m</span></p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-default-400 text-[10px] uppercase font-semibold mb-1">
                    <BarChart3 size={11} /> Sessions
                  </div>
                  <p className="text-lg font-bold tabular-nums">{focusSessionsToday.length}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-default-400 text-[10px] uppercase font-semibold mb-1">
                    <Coffee size={11} /> Break
                  </div>
                  <p className="text-lg font-bold tabular-nums">{breakMinutesToday}<span className="text-xs font-normal text-default-500">m</span></p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-default-400 text-[10px] uppercase font-semibold mb-1">
                    <Flame size={11} /> Long break in
                  </div>
                  <p className="text-lg font-bold tabular-nums">{sessionsUntilLongBreak}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Mode tabs */}
          <div className="max-w-sm mx-auto">
            <Tabs
              selectedKey={mode}
              onSelectionChange={(key) => setMode(key as PomodoroMode)}
              fullWidth
              color={modeMeta.color}
              size="sm"
            >
              <Tab key="focus" title={<div className="flex items-center gap-1"><Brain size={12} />Focus</div>} />
              <Tab key="short_break" title={<div className="flex items-center gap-1"><Coffee size={12} />Short Break</div>} />
              <Tab key="long_break" title={<div className="flex items-center gap-1"><Coffee size={12} />Long Break</div>} />
            </Tabs>
          </div>

          {/* Timer preview */}
          <Card className="max-w-sm mx-auto">
            <CardBody className="p-6 text-center space-y-4">
              <div className="relative">
                <svg className="w-40 h-40 mx-auto transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="none" className="text-default-100" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold tabular-nums">{previewDuration}:00</span>
                </div>
              </div>

              {/* Duration presets (focus only) */}
              {mode === "focus" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {PRESETS.map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={previewDuration === p && !customDuration ? "solid" : "flat"}
                        color={previewDuration === p && !customDuration ? "primary" : "default"}
                        onPress={() => setCustomDuration(String(p))}
                        className="h-7 min-w-12"
                      >
                        {p}m
                      </Button>
                    ))}
                  </div>
                  <Input
                    size="sm"
                    type="number"
                    min={1}
                    max={180}
                    step={5}
                    placeholder={`Custom (default ${settings.workDuration}m)`}
                    value={customDuration}
                    onValueChange={setCustomDuration}
                    endContent={<span className="text-xs text-default-400">min</span>}
                  />
                </div>
              )}

              <Button
                color={modeMeta.color}
                size="lg"
                startContent={<Play size={20} />}
                onPress={handleStart}
                className="px-8 w-full"
              >
                Start {modeMeta.label}
              </Button>

              <div className="flex items-center justify-between border-t border-default-100 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">Auto-start break after focus</span>
                </div>
                <Switch
                  size="sm"
                  isSelected={autoStartNext}
                  onValueChange={setAutoStartNext}
                />
              </div>
            </CardBody>
          </Card>


          {/* Today's Sessions */}
          <Card>
            <CardHeader>
              <span className="text-sm font-semibold">Today&apos;s Sessions</span>
            </CardHeader>
            <CardBody className="space-y-1.5">
              {sessions.length === 0 ? (
                <p className="text-default-400 text-sm text-center py-4">No sessions yet</p>
              ) : (
                sessions.map((session) => {
                  const sMode: PomodoroMode = (session.mode ?? "focus") as PomodoroMode;
                  const sMeta = MODE_META[sMode];
                  const sessionTasks = (session.taskIds || (session.taskId ? [session.taskId] : []))
                    .map((id) => tasks.find((t) => t.id === id))
                    .filter(Boolean) as Task[];
                  const completedTasks = sessionTasks.filter((t) => t.status === "completed");
                  const actualSeconds = session.actualDurationSeconds ?? (session.startedAt && session.completedAt
                    ? differenceInSeconds(session.completedAt.toDate(), session.startedAt.toDate())
                    : 0);
                  const actualMin = Math.floor(actualSeconds / 60);
                  const actualSec = actualSeconds % 60;
                  const statusBadge = session.skipped
                    ? { color: "default" as const, label: "Skipped" }
                    : session.isCompleted
                      ? { color: "success" as const, label: "Done" }
                      : { color: "warning" as const, label: "Incomplete" };

                  return (
                    <div
                      key={session.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-content2 hover:bg-content3 cursor-pointer group"
                      onClick={() => { setViewSession(session); onSessionOpen(); }}
                    >
                      <div className={`p-1 rounded-full mt-0.5 shrink-0 ${
                        session.skipped ? "bg-default-200"
                        : session.isCompleted ? "bg-success/20"
                        : "bg-warning/20"
                      }`}>
                        <Timer size={12} className={
                          session.skipped ? "text-default-500"
                          : session.isCompleted ? "text-success"
                          : "text-warning"
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium flex items-center gap-1 flex-wrap">
                          <Chip size="sm" color={sMeta.color} variant="flat" className="h-4 text-[9px]" startContent={sMeta.icon}>
                            {sMeta.short}
                          </Chip>
                          <span>{session.duration}min planned</span>
                          {actualSeconds > 0 && (
                            <span className="text-default-500">· {actualMin}m {actualSec}s used</span>
                          )}
                          <Chip size="sm" color={statusBadge.color} variant="flat" className="h-4 text-[9px]">{statusBadge.label}</Chip>
                          {session.notes && <FileText size={10} className="text-default-400" />}
                        </div>
                        <p className="text-[10px] text-default-400">
                          {session.startedAt && format(session.startedAt.toDate(), dateFnsTimeFormat(timeFmt))}
                          {session.completedAt && ` → ${format(session.completedAt.toDate(), dateFnsTimeFormat(timeFmt))}`}
                        </p>
                        {sessionTasks.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {sessionTasks.slice(0, 3).map((t) => (
                              <Chip
                                key={t.id}
                                size="sm"
                                variant="flat"
                                color={t.status === "completed" ? "success" : "default"}
                                className="h-4 text-[9px] max-w-[140px]"
                                startContent={t.status === "completed" ? <Check size={8} /> : null}
                              >
                                <span className={`truncate ${t.status === "completed" ? "line-through" : ""}`}>{t.title}</span>
                              </Chip>
                            ))}
                            {sessionTasks.length > 3 && (
                              <span className="text-[9px] text-default-400">+{sessionTasks.length - 3}</span>
                            )}
                          </div>
                        )}
                        {sessionTasks.length > 0 && (
                          <p className="text-[9px] text-default-400 mt-0.5">
                            {completedTasks.length}/{sessionTasks.length} completed
                          </p>
                        )}
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5 shrink-0"
                        onPress={() => {
                          if (confirm("Delete this session?")) deleteSession(session.id);
                        }}
                        title="Delete session"
                      >
                        <Trash2 size={10} />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </motion.div>
      </main>

      {/* Session Details Modal */}
      <Modal isOpen={isSessionOpen} onOpenChange={onSessionOpenChange} size="md" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => {
            if (!viewSession) return null;
            const sMode: PomodoroMode = (viewSession.mode ?? "focus") as PomodoroMode;
            const sMeta = MODE_META[sMode];
            const sessionTasks = (viewSession.taskIds || (viewSession.taskId ? [viewSession.taskId] : []))
              .map((id) => tasks.find((t) => t.id === id))
              .filter(Boolean) as Task[];
            const sessionHabits = (viewSession.habitIds || [])
              .map((id) => habits.find((h) => h.id === id))
              .filter(Boolean);
            const actualSeconds = viewSession.actualDurationSeconds ?? (viewSession.startedAt && viewSession.completedAt
              ? differenceInSeconds(viewSession.completedAt.toDate(), viewSession.startedAt.toDate())
              : 0);
            const actualMin = Math.floor(actualSeconds / 60);
            const actualSec = actualSeconds % 60;

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Timer size={16} className={
                      viewSession.skipped ? "text-default-500"
                      : viewSession.isCompleted ? "text-success"
                      : "text-warning"
                    } />
                    <span>
                      Session {viewSession.skipped ? "Skipped" : viewSession.isCompleted ? "Completed" : "Incomplete"}
                    </span>
                    <Chip size="sm" color={sMeta.color} variant="flat" startContent={sMeta.icon}>
                      {sMeta.label}
                    </Chip>
                  </div>
                  <span className="text-xs font-normal text-default-500">
                    {viewSession.startedAt && format(viewSession.startedAt.toDate(), `MMM d, yyyy · ${dateFnsTimeFormat(timeFmt, true)}`)}
                  </span>
                </ModalHeader>
                <ModalBody>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase text-default-400 font-semibold mb-0.5">Planned</p>
                      <p className="font-medium">{viewSession.duration} min</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-default-400 font-semibold mb-0.5">Actual</p>
                      <p className="font-medium">
                        {actualSeconds > 0 ? `${actualMin}m ${actualSec}s` : "—"}
                      </p>
                    </div>
                    {viewSession.startedAt && (
                      <div>
                        <p className="text-[10px] uppercase text-default-400 font-semibold mb-0.5">Started</p>
                        <p className="font-medium">{format(viewSession.startedAt.toDate(), dateFnsTimeFormat(timeFmt, true))}</p>
                      </div>
                    )}
                    {viewSession.completedAt && (
                      <div>
                        <p className="text-[10px] uppercase text-default-400 font-semibold mb-0.5">Ended</p>
                        <p className="font-medium">{format(viewSession.completedAt.toDate(), dateFnsTimeFormat(timeFmt, true))}</p>
                      </div>
                    )}
                  </div>

                  {sessionTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-default-400 font-semibold mb-1">
                        Linked Tasks ({sessionTasks.filter((t) => t.status === "completed").length}/{sessionTasks.length} completed)
                      </p>
                      <div className="space-y-1">
                        {sessionTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-content2">
                            {t.status === "completed" ? (
                              <Check size={12} className="text-success shrink-0" />
                            ) : (
                              <X size={12} className="text-default-400 shrink-0" />
                            )}
                            <span className={`text-sm truncate flex-1 ${t.status === "completed" ? "line-through text-default-400" : ""}`}>
                              {t.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sessionHabits.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase text-default-400 font-semibold mb-1">Linked Habits</p>
                      <div className="space-y-1">
                        {sessionHabits.map((h: any) => (
                          <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-content2">
                            <span className="text-sm truncate flex-1">{h.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase text-default-400 font-semibold mb-1">Notes</p>
                    {viewSession.notes ? (
                      <p className="text-sm whitespace-pre-wrap p-2 rounded bg-content2">{viewSession.notes}</p>
                    ) : (
                      <p className="text-sm text-default-400 italic">No notes</p>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>Close</Button>
                  <Button
                    color="danger"
                    variant="flat"
                    startContent={<Trash2 size={14} />}
                    onPress={() => {
                      if (confirm("Delete this session?")) {
                        deleteSession(viewSession.id);
                        onClose();
                      }
                    }}
                  >
                    Delete
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
