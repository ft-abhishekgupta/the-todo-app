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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Timer, Clock, ChevronDown, ChevronRight, Trash2, FileText, X } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { usePomodoroTimer, usePomodoroSessions, usePomodoroMutations } from "@/hooks/use-pomodoro";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHabits, useHabitMutations } from "@/hooks/use-habits";
import { format, differenceInSeconds } from "date-fns";
import { Task, PomodoroSession } from "@/types";
import { dateFnsTimeFormat } from "@/lib/time";

function LiveTime({ fmt }: { fmt: "12h" | "24h" }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-sm text-default-500 tabular-nums">{format(time, dateFnsTimeFormat(fmt))}</span>;
}

export default function PomodoroPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const workDuration = userProfile?.pomodoroSettings?.workDuration || 25;
  const timeFmt = userProfile?.timeFormat || "12h";
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
  const { deleteSession } = usePomodoroMutations();
  const { tasks } = useTasks();
  const { updateTask } = useTaskMutations();
  const { habits } = useHabits();
  const { toggleHabitLog } = useHabitMutations();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [viewSession, setViewSession] = useState<PomodoroSession | null>(null);
  const { isOpen: isSessionOpen, onOpen: onSessionOpen, onOpenChange: onSessionOpenChange } = useDisclosure();

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
            <LiveTime fmt={timeFmt} />
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

          {/* Linked tasks in focus - with completion */}
          {selectedTaskIds.length > 0 && (
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

          {/* Linked habits in focus - with completion */}
          {selectedHabitIds.length > 0 && (
            <div className="w-full mb-4">
              <p className="text-[10px] uppercase text-default-400 font-semibold mb-1.5">Focus Habits</p>
              <div className="space-y-1">
                {habits.filter((h) => selectedHabitIds.includes(h.id)).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/5 border border-secondary/20">
                    <Checkbox
                      size="sm"
                      onValueChange={() => handleToggleHabitComplete(h.id)}
                    />
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
      <main className="container mx-auto max-w-full px-4 py-6">
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
                  <div key={task.id}>
                    <div
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTaskIds.includes(task.id) ? "bg-primary/10" : "hover:bg-content2"
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <Checkbox size="sm" isSelected={selectedTaskIds.includes(task.id)} onValueChange={() => toggleTask(task.id)} />
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      {task.subtasks.length > 0 && (
                        <Button
                          size="sm" isIconOnly variant="light" className="w-5 h-5 min-w-5"
                          onPress={(e) => { toggleExpandTask(task.id); }}
                        >
                          {expandedTasks.includes(task.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </Button>
                      )}
                      <Chip size="sm" variant="flat" className="h-4 ml-auto text-[9px]">{task.category}</Chip>
                    </div>
                    {expandedTasks.includes(task.id) && task.subtasks.length > 0 && (
                      <div className="ml-8 mt-0.5 space-y-0.5">
                        {task.subtasks.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 p-1 rounded text-xs text-default-500">
                            <div className={`w-2 h-2 rounded-full ${sub.completed ? "bg-success" : "bg-default-300"}`} />
                            <span className={sub.completed ? "line-through text-default-400" : ""}>{sub.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                sessions.map((session) => {
                  const sessionTasks = (session.taskIds || (session.taskId ? [session.taskId] : []))
                    .map((id) => tasks.find((t) => t.id === id))
                    .filter(Boolean) as Task[];
                  const completedTasks = sessionTasks.filter((t) => t.status === "completed");
                  const actualSeconds = session.startedAt && session.completedAt
                    ? differenceInSeconds(session.completedAt.toDate(), session.startedAt.toDate())
                    : 0;
                  const actualMin = Math.floor(actualSeconds / 60);
                  const actualSec = actualSeconds % 60;

                  return (
                    <div
                      key={session.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-content2 hover:bg-content3 cursor-pointer group"
                      onClick={() => { setViewSession(session); onSessionOpen(); }}
                    >
                      <div className={`p-1 rounded-full mt-0.5 shrink-0 ${session.isCompleted ? "bg-success/20" : "bg-warning/20"}`}>
                        <Timer size={12} className={session.isCompleted ? "text-success" : "text-warning"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium flex items-center gap-1 flex-wrap">
                          <span>{session.duration}min planned</span>
                          {session.isCompleted && actualSeconds > 0 && (
                            <span className="text-default-500">· {actualMin}m {actualSec}s used</span>
                          )}
                          {session.isCompleted ? (
                            <Chip size="sm" color="success" variant="flat" className="h-4 text-[9px]">Done</Chip>
                          ) : (
                            <Chip size="sm" color="warning" variant="flat" className="h-4 text-[9px]">Incomplete</Chip>
                          )}
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
            const sessionTasks = (viewSession.taskIds || (viewSession.taskId ? [viewSession.taskId] : []))
              .map((id) => tasks.find((t) => t.id === id))
              .filter(Boolean) as Task[];
            const sessionHabits = (viewSession.habitIds || [])
              .map((id) => habits.find((h) => h.id === id))
              .filter(Boolean);
            const actualSeconds = viewSession.startedAt && viewSession.completedAt
              ? differenceInSeconds(viewSession.completedAt.toDate(), viewSession.startedAt.toDate())
              : 0;
            const actualMin = Math.floor(actualSeconds / 60);
            const actualSec = actualSeconds % 60;

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Timer size={16} className={viewSession.isCompleted ? "text-success" : "text-warning"} />
                    <span>Session {viewSession.isCompleted ? "Completed" : "Incomplete"}</span>
                  </div>
                  <span className="text-xs font-normal text-default-500">
                    {viewSession.startedAt && format(viewSession.startedAt.toDate(), `MMM d, yyyy · ${dateFnsTimeFormat(timeFmt)}`)}
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
                      <div className="p-3 rounded-lg bg-content2 text-sm whitespace-pre-wrap">{viewSession.notes}</div>
                    ) : (
                      <p className="text-sm text-default-400 italic">No notes for this session.</p>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
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
                    Delete Session
                  </Button>
                  <Button color="primary" onPress={onClose}>Close</Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}

