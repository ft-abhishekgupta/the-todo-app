"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Textarea,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Progress,
} from "@nextui-org/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Trash2,
  Edit,
  ArrowRight,
  GripVertical,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { Task, TaskStatus, TaskPriority, TaskCategory, Subtask } from "@/types";
import { Timestamp } from "firebase/firestore";
import { format, isToday, isYesterday, isTomorrow, isBefore, isAfter, startOfDay, addDays } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const statusOptions: { key: TaskStatus; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "started", label: "Started" },
  { key: "completed", label: "Completed" },
  { key: "blocked", label: "Blocked" },
];

const priorityOptions: { key: TaskPriority; label: string; color: "default" | "primary" | "warning" | "danger" }[] = [
  { key: "low", label: "Low", color: "default" },
  { key: "medium", label: "Medium", color: "primary" },
  { key: "high", label: "High", color: "warning" },
  { key: "urgent", label: "Urgent", color: "danger" },
];

const categoryOptions: { key: TaskCategory; label: string }[] = [
  { key: "work_projects", label: "Work" },
  { key: "personal_projects", label: "Personal" },
  { key: "habits", label: "Habits" },
  { key: "personal_work", label: "Personal Work" },
  { key: "chores", label: "Chores" },
];

type ColumnKey = "overdue" | "yesterday" | "today" | "tomorrow" | "later" | "unscheduled";

function getColumnForTask(task: Task): ColumnKey {
  if (!task.scheduledDate) return "unscheduled";
  const date = task.scheduledDate.toDate();
  const today = startOfDay(new Date());
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  if (isTomorrow(date)) return "tomorrow";
  if (isBefore(date, today)) return "overdue";
  return "later";
}

const columns: { key: ColumnKey; label: string; color: string }[] = [
  { key: "overdue", label: "Overdue", color: "text-danger" },
  { key: "yesterday", label: "Yesterday", color: "text-warning" },
  { key: "today", label: "Today", color: "text-primary" },
  { key: "tomorrow", label: "Tomorrow", color: "text-success" },
  { key: "later", label: "Later", color: "text-default-500" },
  { key: "unscheduled", label: "Unscheduled", color: "text-default-400" },
];

function SortableTask({
  task,
  onToggle,
  onEdit,
  onDelete,
  onMoveNext,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNext: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const subtaskProgress = task.subtasks?.length
    ? (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-content1 border border-divider hover:border-primary/30 transition-all group mb-2"
    >
      <button {...attributes} {...listeners} className="cursor-grab mt-1 opacity-0 group-hover:opacity-100 shrink-0 touch-none">
        <GripVertical size={14} className="text-default-400" />
      </button>
      <Checkbox
        isSelected={task.status === "completed"}
        onValueChange={onToggle}
        color="success"
        size="sm"
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Chip size="sm" variant="flat" color={priorityOptions.find((p) => p.key === task.priority)?.color} className="h-5">
            {task.priority}
          </Chip>
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[10px] text-default-400">
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          )}
          {task.deadline && (
            <span className="text-[10px] text-default-400">
              📅 {format(task.deadline.toDate(), "MMM d")}
            </span>
          )}
        </div>
        {subtaskProgress !== null && (
          <Progress size="sm" value={subtaskProgress} color="primary" className="mt-1.5 max-w-[120px]" />
        )}
      </div>
      <Dropdown>
        <DropdownTrigger>
          <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 shrink-0">
            <MoreVertical size={14} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Task actions">
          <DropdownItem key="edit" startContent={<Edit size={12} />} onPress={onEdit}>Edit</DropdownItem>
          <DropdownItem key="next" startContent={<ArrowRight size={12} />} onPress={onMoveNext}>Move to next day</DropdownItem>
          <DropdownItem key="delete" color="danger" startContent={<Trash2 size={12} />} onPress={onDelete}>Delete</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}

export default function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks, loading: tasksLoading } = useTasks();
  const { projects } = useProjects();
  const { addTask, updateTask, deleteTask, moveToNextDay, reorderTasks } = useTaskMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<ColumnKey>>(new Set());

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("personal_work");
  const [formDeadline, setFormDeadline] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasks, searchQuery]);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnKey, Task[]> = {
      overdue: [],
      yesterday: [],
      today: [],
      tomorrow: [],
      later: [],
      unscheduled: [],
    };
    filteredTasks.forEach((task) => {
      const col = getColumnForTask(task);
      grouped[col].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const openCreateModal = (column?: ColumnKey) => {
    setEditingTask(null);
    resetForm();
    if (column === "today") setFormScheduledDate(format(new Date(), "yyyy-MM-dd"));
    else if (column === "tomorrow") setFormScheduledDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    else if (column === "yesterday") setFormScheduledDate(format(addDays(new Date(), -1), "yyyy-MM-dd"));
    onOpen();
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormCategory(task.category);
    setFormDeadline(task.deadline ? format(task.deadline.toDate(), "yyyy-MM-dd") : "");
    setFormScheduledDate(task.scheduledDate ? format(task.scheduledDate.toDate(), "yyyy-MM-dd") : "");
    setFormTags(task.tags.join(", "));
    setFormNotes(task.notes || "");
    setFormProjectId(task.projectId || "");
    setFormSubtasks(task.subtasks || []);
    onOpen();
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStatus("not_started");
    setFormPriority("medium");
    setFormCategory("personal_work");
    setFormDeadline("");
    setFormScheduledDate(format(new Date(), "yyyy-MM-dd"));
    setFormTags("");
    setFormNotes("");
    setFormProjectId("");
    setFormSubtasks([]);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    const taskData = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      category: formCategory,
      deadline: formDeadline ? Timestamp.fromDate(new Date(formDeadline)) : undefined,
      scheduledDate: formScheduledDate ? Timestamp.fromDate(new Date(formScheduledDate)) : undefined,
      tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: formNotes.trim() || undefined,
      projectId: formProjectId || undefined,
      subtasks: formSubtasks,
    };
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
    } else {
      await addTask(taskData);
    }
    onOpenChange();
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormSubtasks([...formSubtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), completed: false }]);
    setNewSubtask("");
  };

  const toggleColumn = (col: ColumnKey) => {
    const next = new Set(collapsedColumns);
    if (next.has(col)) next.delete(col);
    else next.add(col);
    setCollapsedColumns(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Simple reorder within same column for now
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx !== -1 && newIdx !== -1) {
      const newIds = [...ids];
      newIds.splice(oldIdx, 1);
      newIds.splice(newIdx, 0, active.id as string);
      reorderTasks(newIds);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
              <p className="text-default-500 text-xs sm:text-sm">
                {tasks.length} total · {tasks.filter((t) => t.status === "completed").length} done
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<Search size={14} className="text-default-400" />}
                variant="bordered"
                size="sm"
                className="flex-1 sm:w-48"
              />
              <Button color="primary" size="sm" startContent={<Plus size={16} />} onPress={() => openCreateModal("today")}>
                Add
              </Button>
            </div>
          </div>

          {/* Columns */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {columns.map((col) => {
                const colTasks = tasksByColumn[col.key];
                const isCollapsed = collapsedColumns.has(col.key);
                if (colTasks.length === 0 && col.key !== "today") return null;

                return (
                  <Card key={col.key} shadow="sm" className="h-fit">
                    <CardHeader
                      className="flex justify-between items-center px-3 py-2 cursor-pointer"
                      onClick={() => toggleColumn(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDown size={14} />}
                        <span className={`font-semibold text-sm ${col.color}`}>{col.label}</span>
                        <Chip size="sm" variant="flat" className="h-5">{colTasks.length}</Chip>
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={(e) => { openCreateModal(col.key); }}
                      >
                        <Plus size={14} />
                      </Button>
                    </CardHeader>
                    {!isCollapsed && (
                      <CardBody className="pt-0 px-2 pb-2">
                        <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          {colTasks.map((task) => (
                            <SortableTask
                              key={task.id}
                              task={task}
                              onToggle={() =>
                                updateTask(task.id, {
                                  status: task.status === "completed" ? "not_started" : "completed",
                                })
                              }
                              onEdit={() => openEditModal(task)}
                              onDelete={() => deleteTask(task.id)}
                              onMoveNext={() => moveToNextDay(task.id, task.scheduledDate?.toDate() || new Date())}
                            />
                          ))}
                        </SortableContext>
                        {colTasks.length === 0 && (
                          <p className="text-default-400 text-xs text-center py-4">No tasks</p>
                        )}
                      </CardBody>
                    )}
                  </Card>
                );
              })}
            </div>
          </DndContext>
        </motion.div>

        {/* Create/Edit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>{editingTask ? "Edit Task" : "Create Task"}</ModalHeader>
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
                    <Select label="Category" variant="bordered" size="sm" selectedKeys={[formCategory]} onSelectionChange={(k) => setFormCategory(Array.from(k)[0] as TaskCategory)}>
                      {categoryOptions.map((c) => <SelectItem key={c.key}>{c.label}</SelectItem>)}
                    </Select>
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
                      <Input size="sm" placeholder="Add subtask..." value={newSubtask} onValueChange={setNewSubtask} onKeyDown={(e) => e.key === "Enter" && addSubtask()} variant="bordered" />
                      <Button size="sm" variant="flat" onPress={addSubtask}>Add</Button>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
                  <Button color="primary" size="sm" onPress={handleSubmit}>{editingTask ? "Update" : "Create"}</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
