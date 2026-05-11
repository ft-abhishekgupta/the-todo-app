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
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Tracker, TrackerEntry } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function useTrackers() {
  const { user } = useAuth();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTrackers([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "trackers"),
      where("userId", "==", user.uid),
      where("isActive", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Tracker[];
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setTrackers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return { trackers, loading };
}

export function useTrackerEntries(trackerId?: string) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const constraints = [where("userId", "==", user.uid)];
    if (trackerId) constraints.push(where("trackerId", "==", trackerId));
    const q = query(collection(db, "trackerEntries"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrackerEntry[];
      setEntries(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user, trackerId]);

  return { entries, loading };
}

export function useTrackerMutations() {
  const { user } = useAuth();

  const addTracker = async (
    tracker: Omit<Tracker, "id" | "userId" | "createdAt" | "updatedAt" | "order" | "isActive">
  ) => {
    if (!user) throw new Error("Not authenticated");
    const existing = await getDocs(
      query(collection(db, "trackers"), where("userId", "==", user.uid))
    );
    const clean = Object.fromEntries(
      Object.entries(tracker).filter(([_, v]) => v !== undefined)
    );
    await addDoc(collection(db, "trackers"), {
      ...clean,
      userId: user.uid,
      isActive: true,
      order: existing.size,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    toast.success("Tracker created");
  };

  const updateTracker = async (id: string, updates: Partial<Tracker>) => {
    if (!user) throw new Error("Not authenticated");
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(doc(db, "trackers", id), {
      ...clean,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteTracker = async (id: string) => {
    if (!user) throw new Error("Not authenticated");
    // Soft delete: keep entries for history, but hide from UI.
    await updateDoc(doc(db, "trackers", id), { isActive: false, updatedAt: Timestamp.now() });
    toast.success("Tracker deleted");
  };

  const reorderTrackers = async (ids: string[]) => {
    if (!user) throw new Error("Not authenticated");
    const batch = writeBatch(db);
    ids.forEach((id, i) => batch.update(doc(db, "trackers", id), { order: i }));
    await batch.commit();
  };

  // Upsert a tracker entry for the given period.
  const upsertEntry = async (
    trackerId: string,
    periodKey: string,
    values: Record<string, number>,
    notes?: string
  ) => {
    if (!user) throw new Error("Not authenticated");
    const q = query(
      collection(db, "trackerEntries"),
      where("userId", "==", user.uid),
      where("trackerId", "==", trackerId),
      where("periodKey", "==", periodKey)
    );
    const snap = await getDocs(q);
    const cleanValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === "number" && !Number.isNaN(v)) cleanValues[k] = v;
    }
    if (snap.empty) {
      await addDoc(collection(db, "trackerEntries"), {
        userId: user.uid,
        trackerId,
        periodKey,
        values: cleanValues,
        ...(notes ? { notes } : {}),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } else {
      const docRef = doc(db, "trackerEntries", snap.docs[0].id);
      await updateDoc(docRef, {
        values: cleanValues,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: Timestamp.now(),
      });
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!user) throw new Error("Not authenticated");
    await deleteDoc(doc(db, "trackerEntries", entryId));
  };

  return {
    addTracker,
    updateTracker,
    deleteTracker,
    reorderTrackers,
    upsertEntry,
    deleteEntry,
  };
}
