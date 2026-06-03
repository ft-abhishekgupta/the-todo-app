import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Habit, HabitLog, HabitCategory } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { format, subDays, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from "date-fns";
import { parseLocalDate } from "@/lib/time";
import { isHabitVisibleOn } from "@/lib/habit-visibility";

export function useHabits(category?: HabitCategory) {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHabits([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "habits"),
      where("userId", "==", user.uid),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let habitList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Habit[];

        if (category) {
          habitList = habitList.filter((h) => h.category === category);
        }

        setHabits(habitList);
        setLoading(false);
      },
      (error) => {
        console.error("Habits listener error:", error);
        // Fallback: query without order
        const fallbackQ = query(
          collection(db, "habits"),
          where("userId", "==", user.uid),
          where("isActive", "==", true)
        );
        onSnapshot(fallbackQ, (snapshot) => {
          let habitList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Habit[];
          if (category) {
            habitList = habitList.filter((h) => h.category === category);
          }
          setHabits(habitList);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [user, category]);

  return { habits, loading };
}

export function useHabitLogs(habitId?: string, days: number = 30) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
    // Equality filters must come before inequality (date >=) for Firestore composite indexes
    let constraints = [];
    if (habitId) {
      constraints.push(where("habitId", "==", habitId));
    }
    constraints.push(
      where("userId", "==", user.uid),
      where("date", ">=", startDate)
    );

    const q = query(collection(db, "habitLogs"), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HabitLog[];

      setLogs(logList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, habitId, days]);

  return { logs, loading };
}

export function useHabitMutations() {
  const { user } = useAuth();

  const addHabit = async (
    habit: Omit<Habit, "id" | "userId" | "streak" | "longestStreak" | "createdAt" | "updatedAt">
  ) => {
    if (!user) throw new Error("Not authenticated");

    // Remove undefined fields - Firestore doesn't accept them
    const cleanHabit = Object.fromEntries(
      Object.entries(habit).filter(([_, v]) => v !== undefined)
    );

    await addDoc(collection(db, "habits"), {
      ...cleanHabit,
      userId: user.uid,
      streak: 0,
      longestStreak: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    toast.success("Habit created");
  };

  const toggleHabitLog = async (habitId: string, date: string, completed: boolean) => {
    if (!user) throw new Error("Not authenticated");

    const logsRef = collection(db, "habitLogs");
    const q = query(
      logsRef,
      where("userId", "==", user.uid),
      where("habitId", "==", habitId),
      where("date", "==", date)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await addDoc(logsRef, {
        habitId,
        userId: user.uid,
        date,
        completed,
        createdAt: Timestamp.now(),
      });
    } else {
      const logDoc = snapshot.docs[0];
      await updateDoc(doc(db, "habitLogs", logDoc.id), { completed });
    }

    // Update streak
    await updateStreak(habitId);
  };

  const updateHabitCount = async (habitId: string, date: string, count: number, targetCount: number) => {
    if (!user) throw new Error("Not authenticated");

    const logsRef = collection(db, "habitLogs");
    const q = query(
      logsRef,
      where("userId", "==", user.uid),
      where("habitId", "==", habitId),
      where("date", "==", date)
    );

    const snapshot = await getDocs(q);
    const completed = count >= targetCount;

    if (snapshot.empty) {
      await addDoc(logsRef, {
        habitId,
        userId: user.uid,
        date,
        count,
        completed,
        createdAt: Timestamp.now(),
      });
    } else {
      const logDoc = snapshot.docs[0];
      await updateDoc(doc(db, "habitLogs", logDoc.id), { count, completed });
    }

    if (completed) await updateStreak(habitId);
  };

  const reorderHabits = async (habitIds: string[]) => {
    if (!user) throw new Error("Not authenticated");
    const batch = writeBatch(db);
    habitIds.forEach((id, index) => {
      batch.update(doc(db, "habits", id), { order: index });
    });
    await batch.commit();
  };

  const updateStreak = async (habitId: string) => {
    if (!user) return;

    const habitSnap = await getDocs(
      query(collection(db, "habits"), where("userId", "==", user.uid))
    );
    const currentHabitDoc = habitSnap.docs.find((d) => d.id === habitId);
    if (!currentHabitDoc) return;
    const currentHabit = { id: currentHabitDoc.id, ...currentHabitDoc.data() } as Habit;

    const logsRef = collection(db, "habitLogs");
    const q = query(
      logsRef,
      where("userId", "==", user.uid),
      where("habitId", "==", habitId),
      where("completed", "==", true)
    );

    const snapshot = await getDocs(q);
    const completedDates = new Set(snapshot.docs.map((d) => d.data().date as string));

    let streak = 0;
    const todayStart = parseLocalDate(format(new Date(), "yyyy-MM-dd"));

    if (currentHabit.frequency === "weekly" || currentHabit.frequency === "monthly") {
      // Count completed weeks/months walking backwards from current period.
      const isWeekly = currentHabit.frequency === "weekly";
      const MAX_PERIODS = isWeekly ? 260 : 60; // ~5y of weeks or months
      const periodStart = (d: Date) => (isWeekly ? startOfWeek(d, { weekStartsOn: 0 }) : startOfMonth(d));
      const periodEnd = (d: Date) => (isWeekly ? endOfWeek(d, { weekStartsOn: 0 }) : endOfMonth(d));
      const prevPeriod = (d: Date) => (isWeekly ? subDays(periodStart(d), 1) : subMonths(d, 1));

      let cursor = todayStart;
      for (let i = 0; i < MAX_PERIODS; i++) {
        const start = periodStart(cursor);
        const end = periodEnd(cursor);
        let completedInPeriod = false;
        for (const d of eachDayOfInterval({ start, end })) {
          if (completedDates.has(format(d, "yyyy-MM-dd"))) { completedInPeriod = true; break; }
        }
        if (completedInPeriod) {
          streak++;
        } else if (i > 0) {
          break; // current period may still be in progress
        }
        cursor = prevPeriod(cursor);
      }
    } else {
      // Walk backwards from today, only counting days the habit is visible on.
      // A non-visible day is skipped (doesn't break or extend the streak).
      let cursor = todayStart;
      const MAX_LOOKBACK = 366;
      for (let i = 0; i < MAX_LOOKBACK; i++) {
        const visible = isHabitVisibleOn(currentHabit, cursor);
        if (visible) {
          const key = format(cursor, "yyyy-MM-dd");
          if (completedDates.has(key)) {
            streak++;
          } else {
            // Allow today to be incomplete without breaking streak (encourages completion later in day)
            if (i === 0) {
              // skip
            } else {
              break;
            }
          }
        }
        cursor = subDays(cursor, 1);
      }
    }

    const longestStreak = Math.max(streak, currentHabit.longestStreak || 0);
    await updateDoc(doc(db, "habits", habitId), { streak, longestStreak });
  };

  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    if (!user) throw new Error("Not authenticated");
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(doc(db, "habits", habitId), {
      ...cleanUpdates,
      updatedAt: Timestamp.now(),
    });
    toast.success("Habit updated");
  };

  const setHabitPaused = async (habitId: string, paused: boolean) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "habits", habitId), { isPaused: paused, updatedAt: Timestamp.now() });
    toast.success(paused ? "Habit paused" : "Habit resumed");
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "habits", habitId), { isActive: false });
    toast.success("Habit archived");
  };

  return { addHabit, updateHabit, setHabitPaused, toggleHabitLog, updateHabitCount, reorderHabits, deleteHabit };
}
