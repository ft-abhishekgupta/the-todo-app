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
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { UserList, ListItem } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function useLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "lists"),
      where("userId", "==", user.uid),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserList[];
      setLists(listData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { lists, loading };
}

export function useListMutations() {
  const { user } = useAuth();

  const addList = async (
    list: Omit<UserList, "id" | "userId" | "createdAt" | "updatedAt" | "order" | "isActive" | "items"> & {
      items?: ListItem[];
    }
  ) => {
    if (!user) throw new Error("Not authenticated");

    const listsRef = collection(db, "lists");
    const snapshot = await getDocs(query(listsRef, where("userId", "==", user.uid)));

    const clean = Object.fromEntries(
      Object.entries(list).filter(([, v]) => v !== undefined)
    );

    await addDoc(listsRef, {
      ...clean,
      userId: user.uid,
      order: snapshot.size,
      items: list.items || [],
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    toast.success("List created");
  };

  const updateList = async (listId: string, updates: Partial<UserList>) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "lists", listId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteList = async (listId: string) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(doc(db, "lists", listId), { isActive: false });
    toast.success("List deleted");
  };

  const reorderLists = async (listIds: string[]) => {
    if (!user) throw new Error("Not authenticated");
    const batch = writeBatch(db);
    listIds.forEach((id, index) => {
      batch.update(doc(db, "lists", id), { order: index, updatedAt: Timestamp.now() });
    });
    await batch.commit();
  };

  const addItem = async (listId: string, list: UserList, item: Omit<ListItem, "id" | "createdAt">) => {
    const newItem: ListItem = {
      id: crypto.randomUUID(),
      title: item.title,
      completed: item.completed ?? false,
      ...(item.notes ? { notes: item.notes } : {}),
      ...(item.url ? { url: item.url } : {}),
      createdAt: Timestamp.now(),
    };
    await updateList(listId, { items: [...list.items, newItem] });
  };

  const updateItem = async (listId: string, list: UserList, itemId: string, updates: Partial<ListItem>) => {
    const items = list.items.map((it) =>
      it.id === itemId ? { ...it, ...updates } : it
    );
    await updateList(listId, { items });
  };

  const deleteItem = async (listId: string, list: UserList, itemId: string) => {
    const items = list.items.filter((it) => it.id !== itemId);
    await updateList(listId, { items });
  };

  return { addList, updateList, deleteList, reorderLists, addItem, updateItem, deleteItem };
}
