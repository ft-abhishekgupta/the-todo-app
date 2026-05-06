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
import { ScheduleEvent } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export function useSchedule(date?: string) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "scheduleEvents"),
      where("userId", "==", user.uid),
      orderBy("startTime", "asc")
    );

    if (date) {
      q = query(
        collection(db, "scheduleEvents"),
        where("userId", "==", user.uid),
        where("date", "==", date),
        orderBy("startTime", "asc")
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleEvent));
        setEvents(items);
        setLoading(false);
      },
      (err) => {
        console.error("Schedule listener error:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user, date]);

  return { events, loading };
}

export function useScheduleMutations() {
  const { user } = useAuth();

  const addEvent = async (data: Omit<ScheduleEvent, "id" | "userId" | "createdAt" | "updatedAt">) => {
    if (!user) return;
    const now = Timestamp.now();
    // Strip undefined fields - Firestore rejects them
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await addDoc(collection(db, "scheduleEvents"), {
      ...cleanData,
      userId: user.uid,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateEvent = async (id: string, data: Partial<ScheduleEvent>) => {
    if (!user) return;
    await updateDoc(doc(db, "scheduleEvents", id), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteEvent = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "scheduleEvents", id));
  };

  const duplicateSchedule = async (fromDate: string, toDate: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "scheduleEvents"),
        where("userId", "==", user.uid),
        where("date", "==", fromDate)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      const now = Timestamp.now();

      snap.docs.forEach((d) => {
        const data = d.data();
        const newRef = doc(collection(db, "scheduleEvents"));
        batch.set(newRef, {
          ...data,
          date: toDate,
          linkedTaskId: undefined,
          linkedHabitId: undefined,
          createdAt: now,
          updatedAt: now,
        });
      });

      await batch.commit();
      toast.success(`Schedule duplicated to ${toDate}`);
    } catch (err) {
      toast.error("Failed to duplicate schedule");
    }
  };

  return { addEvent, updateEvent, deleteEvent, duplicateSchedule };
}
