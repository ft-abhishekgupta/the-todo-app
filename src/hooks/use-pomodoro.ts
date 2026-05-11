import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { PomodoroSession, PomodoroMode } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";

export function usePomodoroSessions(date?: string) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const today = date || format(new Date(), "yyyy-MM-dd");
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "pomodoroSessions"),
      where("userId", "==", user.uid),
      where("startedAt", ">=", Timestamp.fromDate(startOfDay)),
      where("startedAt", "<=", Timestamp.fromDate(endOfDay))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PomodoroSession[];
      // Sort client-side by startedAt desc — Firestore snapshot order is not guaranteed.
      sessionList.sort((a, b) => {
        const at = a.startedAt?.toMillis?.() || 0;
        const bt = b.startedAt?.toMillis?.() || 0;
        return bt - at;
      });

      setSessions(sessionList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, date]);

  return { sessions, loading };
}

export function usePomodoroSessionsRange(days: number = 365) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "pomodoroSessions"),
      where("userId", "==", user.uid),
      where("startedAt", ">=", Timestamp.fromDate(start))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PomodoroSession[];
      list.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
      setSessions(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, days]);

  return { sessions, loading };
}

export function usePomodoroMutations() {
  const deleteSession = async (sessionId: string) => {
    await deleteDoc(doc(db, "pomodoroSessions", sessionId));
    toast.success("Session deleted");
  };
  return { deleteSession };
}

export interface PomodoroTimerSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export interface StartSessionOpts {
  mode?: PomodoroMode;
  durationMin?: number;
  taskIds?: string[];
  habitIds?: string[];
}

export function usePomodoroTimer(settings: PomodoroTimerSettings) {
  const { user } = useAuth();
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [activeDuration, setActiveDuration] = useState<number>(settings.workDuration);
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<Date | null>(null);
  const completingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync timeLeft with default duration when settings change and no session running.
  useEffect(() => {
    if (!currentSessionId && !isRunning) {
      const dur = mode === "focus" ? settings.workDuration
        : mode === "short_break" ? settings.shortBreakDuration
        : settings.longBreakDuration;
      setActiveDuration(dur);
      setTimeLeft(dur * 60);
    }
  }, [mode, settings.workDuration, settings.shortBreakDuration, settings.longBreakDuration, currentSessionId, isRunning]);

  const playBeep = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const playTone = (freq: number, when: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + when + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + when);
        osc.stop(ctx.currentTime + when + dur);
      };
      playTone(880, 0, 0.25);
      playTone(660, 0.3, 0.25);
      playTone(880, 0.6, 0.4);
    } catch {
      // ignore audio failures
    }
  }, []);

  const completeSession = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const sessionId = currentSessionId;
    const startedAt = startedAtRef.current;
    const finalNotes = notes;
    if (sessionId) {
      const actual = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0;
      try {
        await updateDoc(doc(db, "pomodoroSessions", sessionId), {
          isCompleted: true,
          completedAt: Timestamp.now(),
          notes: finalNotes,
          actualDurationSeconds: actual,
        });
      } catch (e) {
        console.error("Failed to complete session", e);
      }
    }
    playBeep();
    setCurrentSessionId(null);
    startedAtRef.current = null;
    setNotes("");
    setTimeLeft(activeDuration * 60);
    completingRef.current = false;
  }, [currentSessionId, notes, activeDuration, playBeep]);

  // Decrement timer
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      completeSession();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft, completeSession]);

  const startSession = async (opts: StartSessionOpts = {}) => {
    if (!user) return;
    const sessionMode: PomodoroMode = opts.mode || mode;
    const defaultDur = sessionMode === "focus" ? settings.workDuration
      : sessionMode === "short_break" ? settings.shortBreakDuration
      : settings.longBreakDuration;
    const dur = Math.max(1, Math.min(180, opts.durationMin ?? defaultDur));

    // Initialize audio context on user-gesture-driven start.
    try {
      if (!audioCtxRef.current && typeof window !== "undefined") {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctor) audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }
    } catch {
      // ignore
    }

    const session: any = {
      userId: user.uid,
      duration: dur,
      notes: "",
      startedAt: Timestamp.now(),
      isCompleted: false,
      mode: sessionMode,
    };
    if (opts.taskIds && opts.taskIds.length > 0) session.taskIds = opts.taskIds;
    if (opts.habitIds && opts.habitIds.length > 0) session.habitIds = opts.habitIds;

    const docRef = await addDoc(collection(db, "pomodoroSessions"), session);
    setMode(sessionMode);
    setActiveDuration(dur);
    setCurrentSessionId(docRef.id);
    startedAtRef.current = new Date();
    setIsRunning(true);
    setTimeLeft(dur * 60);
  };

  const pauseSession = () => setIsRunning(false);
  const resumeSession = () => setIsRunning(true);

  const extendSession = async (extraMin: number) => {
    if (!currentSessionId) return;
    const newDuration = Math.min(360, activeDuration + extraMin);
    setActiveDuration(newDuration);
    setTimeLeft((prev) => prev + extraMin * 60);
    try {
      await updateDoc(doc(db, "pomodoroSessions", currentSessionId), { duration: newDuration });
    } catch (e) {
      toast.error("Failed to save extension");
    }
  };

  const skipSession = async () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const sessionId = currentSessionId;
    const startedAt = startedAtRef.current;
    if (sessionId) {
      const actual = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0;
      try {
        await updateDoc(doc(db, "pomodoroSessions", sessionId), {
          isCompleted: false,
          skipped: true,
          completedAt: Timestamp.now(),
          notes,
          actualDurationSeconds: actual,
        });
      } catch (e) {
        console.error("Failed to skip session", e);
      }
    }
    setCurrentSessionId(null);
    startedAtRef.current = null;
    setNotes("");
    setTimeLeft(activeDuration * 60);
  };

  const resetTimer = async () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const sessionId = currentSessionId;
    if (sessionId) {
      // discard the session entirely
      try {
        await deleteDoc(doc(db, "pomodoroSessions", sessionId));
      } catch {
        // ignore
      }
    }
    setCurrentSessionId(null);
    startedAtRef.current = null;
    setNotes("");
    setTimeLeft(activeDuration * 60);
  };

  return {
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
  };
}
