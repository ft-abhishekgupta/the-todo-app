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
  getDocs,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Project } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("userId", "==", user.uid),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];

      setProjects(projectList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { projects, loading };
}

export function useProjectMutations() {
  const { user } = useAuth();

  const addProject = async (
    project: Omit<Project, "id" | "userId" | "createdAt" | "updatedAt">
  ) => {
    if (!user) throw new Error("Not authenticated");

    const cleanProject = Object.fromEntries(
      Object.entries(project).filter(([_, v]) => v !== undefined)
    );

    await addDoc(collection(db, "projects"), {
      ...cleanProject,
      userId: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    toast.success("Project created");
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "projects", projectId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteProject = async (projectId: string) => {
    if (!user) throw new Error("Not authenticated");

    // Cascade-delete all tasks belonging to the project.
    const tasksSnap = await getDocs(
      query(
        collection(db, "tasks"),
        where("userId", "==", user.uid),
        where("projectId", "==", projectId)
      )
    );

    // Firestore batches are capped at 500 writes; chunk to be safe.
    const docs = [...tasksSnap.docs];
    const CHUNK = 450;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, "projects", projectId));
    toast.success(
      docs.length > 0
        ? `Project deleted (${docs.length} task${docs.length === 1 ? "" : "s"} removed)`
        : "Project deleted"
    );
  };

  return { addProject, updateProject, deleteProject };
}
