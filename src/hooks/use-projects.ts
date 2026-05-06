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

    await addDoc(collection(db, "projects"), {
      ...project,
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
    await updateDoc(doc(db, "projects", projectId), { isActive: false });
    toast.success("Project archived");
  };

  return { addProject, updateProject, deleteProject };
}
