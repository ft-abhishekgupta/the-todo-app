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
import { Timestamp, deleteField } from "firebase/firestore";
import { parseLocalDate } from "@/lib/time";
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskSubtype,
  Subtask,
  RecurrenceRule,
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
    { key: "project_task", label: "Project" },
    { key: "general_task", label: "General" },
    { key: "chores", label: "Chores" },
  ],
  personal: [
    { key: "general_task", label: "General" },
    { key: "project_task", label: "Project" },
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

// Pre-select "General" when switching to work/personal so users don't have
// to pick the most common subcategory by hand.
function defaultSubtypeFor(category: TaskCategory): TaskSubtype | "" {
  if (category === "work" || category === "personal") return "general_task";
  return "";
}

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
  const [formSubtype, setFormSubtype] = useState<TaskSubtype | "">("general_task");
  const [formDeadline, setFormDeadline] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  // Recurrence
  const [formRecurrenceType, setFormRecurrenceType] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [formRecurrenceInterval, setFormRecurrenceInterval] = useState<number>(1);
  const [formRecurrenceDays, setFormRecurrenceDays] = useState<number[]>([]);
  const [formRecurrenceDayOfMonth, setFormRecurrenceDayOfMonth] = useState<number | "">("");
  const [formRecurrenceEnd, setFormRecurrenceEnd] = useState("");

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
      const r = task.recurrence;
      setFormRecurrenceType(r?.type ?? "none");
      setFormRecurrenceInterval(r?.interval ?? 1);
      setFormRecurrenceDays(r?.daysOfWeek ?? []);
      setFormRecurrenceDayOfMonth(r?.dayOfMonth ?? "");
      setFormRecurrenceEnd(r?.endDate ? format(r.endDate.toDate(), "yyyy-MM-dd") : "");
    } else {
      setFormTitle("");
      setFormDescription("");
      setFormStatus("not_started");
      setFormPriority("medium");
      setFormCategory(defaultCategory || "work");
      setFormSubtype(defaultSubtypeFor(defaultCategory || "work"));
      setFormDeadline("");
      setFormScheduledDate(defaultScheduledDate ? format(defaultScheduledDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setFormTags("");
      setFormNotes("");
      setFormProjectId(defaultProjectId || "");
      setFormSubtasks([]);
      setFormRecurrenceType("none");
      setFormRecurrenceInterval(1);
      setFormRecurrenceDays([]);
      setFormRecurrenceDayOfMonth("");
      setFormRecurrenceEnd("");
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
    const isEdit = !!task;

    let recurrenceValue: RecurrenceRule | undefined | ReturnType<typeof deleteField> = undefined;
    if (formRecurrenceType === "none") {
      recurrenceValue = isEdit && task?.recurrence ? (deleteField() as never) : undefined;
    } else {
      const rule: RecurrenceRule = { type: formRecurrenceType };
      if (formRecurrenceInterval > 1) rule.interval = formRecurrenceInterval;
      if (formRecurrenceType === "weekly" && formRecurrenceDays.length > 0)
        rule.daysOfWeek = [...formRecurrenceDays].sort((a, b) => a - b);
      if (formRecurrenceType === "monthly" && formRecurrenceDayOfMonth !== "")
        rule.dayOfMonth = Number(formRecurrenceDayOfMonth);
      if (formRecurrenceEnd) rule.endDate = Timestamp.fromDate(parseLocalDate(formRecurrenceEnd));
      recurrenceValue = rule;
    }

    const taskData = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      category: formCategory,
      subtype: formSubtype || undefined,
      deadline: formDeadline
        ? Timestamp.fromDate(parseLocalDate(formDeadline))
        : (isEdit ? (deleteField() as never) : undefined),
      scheduledDate: formScheduledDate
        ? Timestamp.fromDate(parseLocalDate(formScheduledDate))
        : (isEdit ? (deleteField() as never) : undefined),
      recurrence: recurrenceValue,
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
                <Select label="Category" variant="bordered" size="sm" selectedKeys={[formCategory]} onSelectionChange={(k) => { const cat = Array.from(k)[0] as TaskCategory; setFormCategory(cat); setFormSubtype(defaultSubtypeFor(cat)); }}>
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

              {/* Recurrence */}
              <div className="space-y-2 border border-default-200 rounded-md p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">Repeat</p>
                  <Select
                    aria-label="Recurrence"
                    size="sm"
                    variant="bordered"
                    className="max-w-[160px]"
                    selectedKeys={[formRecurrenceType]}
                    onSelectionChange={(k) =>
                      setFormRecurrenceType(Array.from(k)[0] as typeof formRecurrenceType)
                    }
                  >
                    <SelectItem key="none">Does not repeat</SelectItem>
                    <SelectItem key="daily">Daily</SelectItem>
                    <SelectItem key="weekly">Weekly</SelectItem>
                    <SelectItem key="monthly">Monthly</SelectItem>
                  </Select>
                </div>
                {formRecurrenceType !== "none" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-default-500">Every</span>
                      <Input
                        type="number"
                        size="sm"
                        variant="bordered"
                        className="max-w-[80px]"
                        min={1}
                        value={String(formRecurrenceInterval)}
                        onValueChange={(v) =>
                          setFormRecurrenceInterval(Math.max(1, parseInt(v) || 1))
                        }
                      />
                      <span className="text-xs text-default-500">
                        {formRecurrenceType === "daily"
                          ? "day(s)"
                          : formRecurrenceType === "weekly"
                          ? "week(s)"
                          : "month(s)"}
                      </span>
                    </div>
                    {formRecurrenceType === "weekly" && (
                      <div className="flex flex-wrap gap-1">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => {
                          const active = formRecurrenceDays.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`px-2 py-1 rounded text-[11px] border ${
                                active
                                  ? "bg-primary text-white border-primary"
                                  : "bg-content1 border-default-300"
                              }`}
                              onClick={() =>
                                setFormRecurrenceDays((prev) =>
                                  prev.includes(i)
                                    ? prev.filter((x) => x !== i)
                                    : [...prev, i]
                                )
                              }
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {formRecurrenceType === "monthly" && (
                      <Input
                        type="number"
                        size="sm"
                        variant="bordered"
                        label="Day of month (optional)"
                        min={1}
                        max={31}
                        value={formRecurrenceDayOfMonth === "" ? "" : String(formRecurrenceDayOfMonth)}
                        onValueChange={(v) =>
                          setFormRecurrenceDayOfMonth(v === "" ? "" : Math.min(31, Math.max(1, parseInt(v) || 1)))
                        }
                      />
                    )}
                    <Input
                      type="date"
                      size="sm"
                      variant="bordered"
                      label="Stop repeating after (optional)"
                      value={formRecurrenceEnd}
                      onValueChange={setFormRecurrenceEnd}
                    />
                    <p className="text-[10px] text-default-400">
                      A new task is created automatically when this one is completed.
                    </p>
                  </div>
                )}
              </div>

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
