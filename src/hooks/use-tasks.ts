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
import { Task, TaskStatus, TaskPriority, TaskCategory, Subtask } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";

export function useTasks(filters?: {
  status?: TaskStatus;
  category?: TaskCategory;
  projectId?: string;
  scheduledDate?: string; // YYYY-MM-DD
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let taskList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];

      // Apply client-side filters
      if (filters?.status) {
        taskList = taskList.filter((t) => t.status === filters.status);
      }
      if (filters?.category) {
        taskList = taskList.filter((t) => t.category === filters.category);
      }
      if (filters?.projectId) {
        taskList = taskList.filter((t) => t.projectId === filters.projectId);
      }
      if (filters?.scheduledDate) {
        taskList = taskList.filter((t) => {
          if (!t.scheduledDate) return false;
          // Compare in LOCAL calendar terms. `toISOString()` yields UTC, which
          // shifts the date for users east of UTC and would surface yesterday's
          // tasks as today (and vice-versa) past local midnight.
          const date = format(t.scheduledDate.toDate(), "yyyy-MM-dd");
          return date === filters.scheduledDate;
        });
      }

      setTasks(taskList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filters?.status, filters?.category, filters?.projectId, filters?.scheduledDate]);

  return { tasks, loading };
}

export function useTaskMutations() {
  const { user } = useAuth();

  const addTask = async (
    task: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt" | "order">
  ) => {
    if (!user) throw new Error("Not authenticated");

    const tasksRef = collection(db, "tasks");
    const snapshot = await getDocs(
      query(tasksRef, where("userId", "==", user.uid))
    );

    // Remove undefined fields - Firestore doesn't accept them
    const cleanTask = Object.fromEntries(
      Object.entries(task).filter(([_, v]) => v !== undefined)
    );

    const newTask = {
      ...cleanTask,
      userId: user.uid,
      order: snapshot.size,
      subtasks: task.subtasks || [],
      tags: task.tags || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(tasksRef, newTask);
    toast.success("Task created");
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!user) throw new Error("Not authenticated");

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const taskRef = doc(db, "tasks", taskId);
    await updateDoc(taskRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteTask = async (taskId: string) => {
    if (!user) throw new Error("Not authenticated");
    await deleteDoc(doc(db, "tasks", taskId));
    toast.success("Task deleted");
  };

  const reorderTasks = async (taskIds: string[]) => {
    if (!user) throw new Error("Not authenticated");
    const batch = writeBatch(db);
    taskIds.forEach((id, index) => {
      batch.update(doc(db, "tasks", id), { order: index });
    });
    await batch.commit();
  };

  const moveToNextDay = async (taskId: string, currentDate: Date) => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    await updateTask(taskId, {
      scheduledDate: Timestamp.fromDate(nextDay),
    });
    toast.success("Task moved to next day");
  };

  return { addTask, updateTask, deleteTask, reorderTasks, moveToNextDay };
}

export function useTodayTasks() {
  // LOCAL "today" — `toISOString()` would return UTC and roll the date back
  // for IST/EST/etc. users after local midnight.
  const today = format(new Date(), "yyyy-MM-dd");
  return useTasks({ scheduledDate: today });
}
