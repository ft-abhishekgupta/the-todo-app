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
import { format, subDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/time";

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

    const logsRef = collection(db, "habitLogs");
    const q = query(
      logsRef,
      where("userId", "==", user.uid),
      where("habitId", "==", habitId),
      where("completed", "==", true)
    );

    const snapshot = await getDocs(q);
    const dates = snapshot.docs
      .map((d) => d.data().date as string)
      .sort()
      .reverse();

    let streak = 0;
    const today = format(new Date(), "yyyy-MM-dd");
    let checkDate = today;

    for (const date of dates) {
      if (date === checkDate) {
        streak++;
        checkDate = format(subDays(parseLocalDate(checkDate), 1), "yyyy-MM-dd");
      } else if (date < checkDate) {
        break;
      }
    }

    const habitRef = doc(db, "habits", habitId);
    const habitSnap = await getDocs(
      query(collection(db, "habits"), where("userId", "==", user.uid))
    );
    const currentHabit = habitSnap.docs.find((d) => d.id === habitId);
    const longestStreak = Math.max(
      streak,
      (currentHabit?.data() as Habit)?.longestStreak || 0
    );

    await updateDoc(habitRef, { streak, longestStreak });
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "habits", habitId), { isActive: false });
    toast.success("Habit archived");
  };

  return { addHabit, toggleHabitLog, updateHabitCount, reorderHabits, deleteHabit };
}
