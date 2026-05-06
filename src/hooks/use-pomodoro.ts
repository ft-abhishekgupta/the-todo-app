import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { PomodoroSession } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";

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

      setSessions(sessionList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, date]);

  return { sessions, loading };
}

export function usePomodoroTimer(workDuration: number = 25) {
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [isRunning, timeLeft]);

  const startSession = async (taskIds?: string[], habitIds?: string[]) => {
    if (!user) return;

    const session: any = {
      userId: user.uid,
      duration: workDuration,
      notes: "",
      startedAt: Timestamp.now(),
      isCompleted: false,
    };
    if (taskIds && taskIds.length > 0) session.taskIds = taskIds;
    if (habitIds && habitIds.length > 0) session.habitIds = habitIds;

    const docRef = await addDoc(collection(db, "pomodoroSessions"), session);
    setCurrentSessionId(docRef.id);
    setIsRunning(true);
    setTimeLeft(workDuration * 60);
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resumeSession = () => {
    setIsRunning(true);
  };

  const completeSession = async () => {
    setIsRunning(false);
    if (currentSessionId) {
      await updateDoc(doc(db, "pomodoroSessions", currentSessionId), {
        isCompleted: true,
        completedAt: Timestamp.now(),
        notes,
      });
    }
    setCurrentSessionId(null);
    setTimeLeft(workDuration * 60);
    setNotes("");
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(workDuration * 60);
    setCurrentSessionId(null);
    setNotes("");
  };

  return {
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
  };
}
