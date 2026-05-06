"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
} from "@nextui-org/react";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskSubtype,
  Subtask,
} from "@/types";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";

const statusOptions: { key: TaskStatus; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "completed", label: "Completed" },
  { key: "blocked", label: "Blocked" },
];

const priorityOptions: { key: TaskPriority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

const categoryOptions: { key: TaskCategory; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "growth", label: "Growth" },
];

const subtypeOptions: Record<TaskCategory, { key: TaskSubtype; label: string }[]> = {
  work: [
    { key: "project_task", label: "Project Task" },
    { key: "general_task", label: "General Task" },
    { key: "chores", label: "Chores" },
  ],
  personal: [
    { key: "general_task", label: "General Task" },
    { key: "project_task", label: "Project Task" },
    { key: "chores", label: "Chores" },
    { key: "social", label: "Social" },
  ],
  growth: [
    { key: "professional_learning", label: "Professional Learning" },
    { key: "personal_learning", label: "Personal Learning" },
    { key: "improvement", label: "Improvement" },
  ],
  habit: [],
};

export interface TaskEditModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  task: Task | null;
  defaultScheduledDate?: Date;
  defaultProjectId?: string;
  defaultCategory?: TaskCategory;
}

export function TaskEditModal({
  isOpen,
  onOpenChange,
  task,
  defaultScheduledDate,
  defaultProjectId,
  defaultCategory,
}: TaskEditModalProps) {
  const { addTask, updateTask, deleteTask } = useTaskMutations();
  const { projects } = useProjects();

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("work");
  const [formSubtype, setFormSubtype] = useState<TaskSubtype | "">("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  // Hydrate form whenever modal opens or task changes
  useEffect(() => {
    if (!isOpen) return;
    if (task) {
      setFormTitle(task.title);
      setFormDescription(task.description || "");
      setFormStatus(task.status);
      setFormPriority(task.priority);
      setFormCategory(task.category);
      setFormSubtype(task.subtype || "");
      setFormDeadline(task.deadline ? format(task.deadline.toDate(), "yyyy-MM-dd") : "");
      setFormScheduledDate(task.scheduledDate ? format(task.scheduledDate.toDate(), "yyyy-MM-dd") : "");
      setFormTags(task.tags.join(", "));
      setFormNotes(task.notes || "");
      setFormProjectId(task.projectId || "");
      setFormSubtasks(task.subtasks || []);
    } else {
      setFormTitle("");
      setFormDescription("");
      setFormStatus("not_started");
      setFormPriority("medium");
      setFormCategory(defaultCategory || "work");
      setFormSubtype("");
      setFormDeadline("");
      setFormScheduledDate(defaultScheduledDate ? format(defaultScheduledDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setFormTags("");
      setFormNotes("");
      setFormProjectId(defaultProjectId || "");
      setFormSubtasks([]);
    }
    setNewSubtask("");
  }, [isOpen, task, defaultScheduledDate, defaultProjectId, defaultCategory]);

  const addFormSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormSubtasks([...formSubtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), completed: false }]);
    setNewSubtask("");
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    const taskData = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      category: formCategory,
      subtype: formSubtype || undefined,
      deadline: formDeadline ? Timestamp.fromDate(new Date(formDeadline)) : undefined,
      scheduledDate: formScheduledDate ? Timestamp.fromDate(new Date(formScheduledDate)) : undefined,
      tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: formNotes.trim() || undefined,
      projectId: formProjectId || undefined,
      subtasks: formSubtasks,
    };
    if (task) {
      await updateTask(task.id, taskData);
    } else {
      await addTask(taskData);
    }
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>{task ? "Edit Task" : "Create Task"}</ModalHeader>
            <ModalBody className="space-y-3">
              <Input label="Title" placeholder="What needs to be done?" value={formTitle} onValueChange={setFormTitle} isRequired variant="bordered" size="sm" />
              <Textarea label="Description" placeholder="Details..." value={formDescription} onValueChange={setFormDescription} variant="bordered" size="sm" minRows={2} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Status" variant="bordered" size="sm" selectedKeys={[formStatus]} onSelectionChange={(k) => setFormStatus(Array.from(k)[0] as TaskStatus)}>
                  {statusOptions.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                </Select>
                <Select label="Priority" variant="bordered" size="sm" selectedKeys={[formPriority]} onSelectionChange={(k) => setFormPriority(Array.from(k)[0] as TaskPriority)}>
                  {priorityOptions.map((p) => <SelectItem key={p.key}>{p.label}</SelectItem>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Category" variant="bordered" size="sm" selectedKeys={[formCategory]} onSelectionChange={(k) => { setFormCategory(Array.from(k)[0] as TaskCategory); setFormSubtype(""); }}>
                  {categoryOptions.map((c) => <SelectItem key={c.key}>{c.label}</SelectItem>)}
                </Select>
                {subtypeOptions[formCategory]?.length > 0 && (
                  <Select label="Subcategory" variant="bordered" size="sm" selectedKeys={formSubtype ? [formSubtype] : []} onSelectionChange={(k) => setFormSubtype(Array.from(k)[0] as TaskSubtype)}>
                    {subtypeOptions[formCategory].map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                  </Select>
                )}
                {projects.length > 0 && (
                  <Select label="Project" variant="bordered" size="sm" selectedKeys={formProjectId ? [formProjectId] : []} onSelectionChange={(k) => setFormProjectId(Array.from(k)[0] as string)}>
                    {projects.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" label="Scheduled" value={formScheduledDate} onValueChange={setFormScheduledDate} variant="bordered" size="sm" />
                <Input type="date" label="Deadline" value={formDeadline} onValueChange={setFormDeadline} variant="bordered" size="sm" />
              </div>
              <Input label="Tags" placeholder="Comma separated" value={formTags} onValueChange={setFormTags} variant="bordered" size="sm" />
              <Textarea label="Notes" value={formNotes} onValueChange={setFormNotes} variant="bordered" size="sm" minRows={2} />

              {/* Subtasks */}
              <div className="space-y-2">
                <p className="text-xs font-medium">Subtasks</p>
                {formSubtasks.map((st, i) => (
                  <div key={st.id} className="flex items-center gap-2">
                    <Checkbox size="sm" isSelected={st.completed} onValueChange={(c) => { const u = [...formSubtasks]; u[i] = { ...st, completed: c }; setFormSubtasks(u); }} />
                    <span className={`text-xs flex-1 ${st.completed ? "line-through text-default-400" : ""}`}>{st.title}</span>
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => setFormSubtasks(formSubtasks.filter((_, idx) => idx !== i))}><Trash2 size={12} /></Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input size="sm" placeholder="Add subtask..." value={newSubtask} onValueChange={setNewSubtask} onKeyDown={(e) => e.key === "Enter" && addFormSubtask()} variant="bordered" />
                  <Button size="sm" variant="flat" onPress={addFormSubtask}>Add</Button>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              {task && (
                <Button color="danger" variant="flat" size="sm" className="mr-auto" onPress={() => { deleteTask(task.id); onClose(); }}>
                  <Trash2 size={14} /> Delete
                </Button>
              )}
              <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
              <Button color="primary" size="sm" onPress={handleSubmit}>{task ? "Update" : "Create"}</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
