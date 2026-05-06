"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Divider,
  Chip,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileJson,
  Database,
  User,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import toast from "react-hot-toast";

const COLLECTIONS = ["tasks", "habits", "habitLogs", "pomodoroSessions", "projects", "scheduleEvents", "lists"] as const;

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const {
    isOpen: isResetOpen,
    onOpen: onResetOpen,
    onOpenChange: onResetOpenChange,
  } = useDisclosure();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData: Record<string, unknown[]> = {};

      for (const collectionName of COLLECTIONS) {
        const q = query(
          collection(db, collectionName),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        exportData[collectionName] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      // Also export user profile
      exportData["userProfile"] = userProfile ? [userProfile] : [];

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TheTodoApp-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text) as Record<string, unknown[]>;

      // Validate structure
      const validCollections = [...COLLECTIONS, "userProfile"];
      const keys = Object.keys(importData);
      const invalidKeys = keys.filter((k) => !validCollections.includes(k as typeof validCollections[number]));
      if (invalidKeys.length > 0) {
        toast.error(`Invalid data format. Unknown collections: ${invalidKeys.join(", ")}`);
        return;
      }

      let totalImported = 0;

      for (const collectionName of COLLECTIONS) {
        const items = importData[collectionName];
        if (!items || !Array.isArray(items)) continue;

        const batch = writeBatch(db);
        for (const item of items) {
          const { id, ...data } = item as { id: string; [key: string]: unknown };
          // Override userId to current user for security
          const docRef = doc(db, collectionName, id);
          batch.set(docRef, { ...data, userId: user.uid });
          totalImported++;
        }
        await batch.commit();
      }

      // Import user profile
      if (importData["userProfile"] && Array.isArray(importData["userProfile"]) && importData["userProfile"].length > 0) {
        const profileData = importData["userProfile"][0] as Record<string, unknown>;
        const { id, ...data } = profileData;
        const batch = writeBatch(db);
        batch.set(doc(db, "users", user.uid), { ...data, id: user.uid });
        await batch.commit();
      }

      toast.success(`Imported ${totalImported} items successfully`);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Import failed. Please check the file format.");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReset = async () => {
    if (resetConfirmText !== "DELETE") return;

    setResetting(true);
    try {
      for (const collectionName of COLLECTIONS) {
        const q = query(
          collection(db, collectionName),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);

        // Firestore batch delete (max 500 per batch)
        const batches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        for (const docSnap of snapshot.docs) {
          currentBatch.delete(doc(db, collectionName, docSnap.id));
          count++;
          if (count % 500 === 0) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
          }
        }
        batches.push(currentBatch);

        for (const batch of batches) {
          await batch.commit();
        }
      }

      toast.success("All data has been deleted");
      onResetOpenChange();
      setResetConfirmText("");
    } catch (error) {
      console.error("Reset failed:", error);
      toast.error("Reset failed. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-2xl font-bold">Settings</h1>

          {/* Profile Info */}
          <Card>
            <CardHeader className="flex gap-3">
              <User size={20} />
              <span className="font-semibold">Profile</span>
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-default-500 text-sm">Name</span>
                <span className="font-medium">{user.displayName}</span>
              </div>
              <Divider />
              <div className="flex justify-between items-center">
                <span className="text-default-500 text-sm">Email</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <Divider />
              <div className="flex justify-between items-center">
                <span className="text-default-500 text-sm">User ID</span>
                <Chip size="sm" variant="flat" className="font-mono text-xs">
                  {user.uid.substring(0, 12)}...
                </Chip>
              </div>
            </CardBody>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader className="flex gap-3">
              <Database size={20} />
              <span className="font-semibold">Data Management</span>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Export */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Download size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Export Data</p>
                    <p className="text-default-500 text-xs">
                      Download all your data (tasks, habits, projects, lists, pomodoros, schedule) as JSON
                    </p>
                  </div>
                </div>
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  startContent={<FileJson size={14} />}
                  isLoading={exporting}
                  onPress={handleExport}
                >
                  Export JSON
                </Button>
              </div>

              {/* Import */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <Upload size={18} className="text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Import Data</p>
                    <p className="text-default-500 text-xs">
                      Restore data from a previously exported JSON file
                    </p>
                  </div>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                  <Button
                    color="success"
                    variant="flat"
                    size="sm"
                    startContent={<Upload size={14} />}
                    isLoading={importing}
                    onPress={() => fileInputRef.current?.click()}
                  >
                    Import JSON
                  </Button>
                </div>
              </div>

              <Divider />

              {/* Reset */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-danger/10">
                    <Trash2 size={18} className="text-danger" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-danger">Reset All Data</p>
                    <p className="text-default-500 text-xs">
                      Permanently delete tasks, habits, projects, lists, sessions & schedule
                    </p>
                  </div>
                </div>
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  startContent={<AlertTriangle size={14} />}
                  onPress={onResetOpen}
                >
                  Reset
                </Button>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Reset Confirmation Modal */}
        <Modal isOpen={isResetOpen} onOpenChange={onResetOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex items-center gap-2 text-danger">
                  <AlertTriangle size={20} />
                  Confirm Data Reset
                </ModalHeader>
                <ModalBody>
                  <p className="text-sm">
                    This action is <strong>irreversible</strong>. All your data will be permanently
                    deleted, including:
                  </p>
                  <ul className="list-disc list-inside text-sm text-default-500 space-y-1 mt-2">
                    <li>All tasks and subtasks</li>
                    <li>All habits and habit logs</li>
                    <li>All pomodoro sessions</li>
                    <li>All projects</li>
                    <li>All lists and list items</li>
                    <li>All schedule events</li>
                  </ul>
                  <p className="text-sm mt-3">
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-divider bg-content2 text-sm font-mono focus:outline-none focus:border-danger"
                    placeholder="Type DELETE"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="danger"
                    isLoading={resetting}
                    isDisabled={resetConfirmText !== "DELETE"}
                    onPress={handleReset}
                  >
                    Delete All Data
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
