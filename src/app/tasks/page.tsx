"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
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
  Progress,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { Task, TaskStatus, TaskPriority, TaskCategory, TaskSubtype, Subtask } from "@/types";
import { Timestamp } from "firebase/firestore";
import { format, isToday, isYesterday, isTomorrow, isBefore, startOfDay, addDays } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const statusOptions: { key: TaskStatus; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "completed", label: "Completed" },
  { key: "blocked", label: "Blocked" },
];

const priorityOptions: { key: TaskPriority; label: string; color: "default" | "primary" | "warning" | "danger" }[] = [
  { key: "low", label: "Low", color: "default" },
  { key: "medium", label: "Medium", color: "primary" },
  { key: "high", label: "High", color: "warning" },
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

type ColumnKey = "past" | "yesterday" | "today" | "tomorrow" | "future";

function getColumnForTask(task: Task): ColumnKey {
  if (!task.scheduledDate) return "future";
  const date = task.scheduledDate.toDate();
  const today = startOfDay(new Date());
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  if (isTomorrow(date)) return "tomorrow";
  if (isBefore(date, today)) return "past";
  return "future";
}

const columns: { key: ColumnKey; label: string; color: string }[] = [
  { key: "past", label: "Past", color: "text-danger" },
  { key: "yesterday", label: "Yesterday", color: "text-warning" },
  { key: "today", label: "Today", color: "text-primary" },
  { key: "tomorrow", label: "Tomorrow", color: "text-success" },
  { key: "future", label: "Future", color: "text-default-500" },
];

function getDateForColumn(col: ColumnKey): Date {
  const today = startOfDay(new Date());
  switch (col) {
    case "past": return addDays(today, -3);
    case "yesterday": return addDays(today, -1);
    case "today": return today;
    case "tomorrow": return addDays(today, 1);
    case "future": return addDays(today, 3);
  }
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[100px] transition-colors rounded-lg ${isOver ? "bg-primary/5" : ""}`}>
      {children}
    </div>
  );
}

function SortableSubtaskRow({
  subtask,
  onToggle,
  onUpdateTitle,
  onDelete,
}: {
  subtask: Subtask;
  onToggle: () => void;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
}){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== subtask.title) {
      onUpdateTitle(editValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 pl-9 py-0.5 group/sub">
      <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/sub:opacity-100 touch-none shrink-0">
        <GripVertical size={10} className="text-default-300" />
      </button>
      <div
        className={`w-3 h-3 rounded-sm border flex items-center justify-center cursor-pointer shrink-0 ${
          subtask.completed ? "bg-success/70 border-success" : "border-default-300 hover:border-primary"
        }`}
        onClick={onToggle}
      >
        {subtask.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {isEditing ? (
        <input
          className="text-xs bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          autoFocus
        />
      ) : (
        <span
          className={`text-xs truncate cursor-text ${subtask.completed ? "line-through text-default-400" : "text-default-600"}`}
          onClick={() => { setIsEditing(true); setEditValue(subtask.title); }}
        >
          {subtask.title}
        </span>
      )}
      <Button
        isIconOnly
        size="sm"
        variant="light"
        color="danger"
        className="opacity-0 group-hover/sub:opacity-100 w-4 h-4 min-w-4 shrink-0"
        onPress={onDelete}
        title="Delete subtask"
      >
        <X size={9} />
      </Button>
    </div>
  );
}

function SortableTask({
  task,
  onToggle,
  onEdit,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
  onUpdateTitle,
  onTogglePriority,
  onUpdateSubtaskTitle,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onUpdateTitle: (taskId: string, title: string) => void;
  onTogglePriority: (taskId: string, currentPriority: TaskPriority) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
}){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const subtasks = task.subtasks || [];
  const completedSubs = subtasks.filter((s) => s.completed).length;

  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = subtasks.findIndex((s) => s.id === active.id);
    const newIdx = subtasks.findIndex((s) => s.id === over.id);
    onReorderSubtasks(task.id, arrayMove(subtasks, oldIdx, newIdx));
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    setAddingSubtask(false);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(task.title);
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdateTitle(task.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const priorityDotColors: Record<TaskPriority, string> = {
    low: "bg-orange-400",
    medium: "bg-blue-500",
    high: "bg-red-500",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-content1 border border-divider hover:border-primary/30 rounded-lg transition-all mb-1.5 cursor-grab active:cursor-grabbing touch-none"
      onContextMenu={(e) => { e.preventDefault(); onEdit(); }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 group">
        {/* Checkbox - blocked shows indeterminate */}
        <div
          className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
            task.status === "completed"
              ? "bg-success border-success"
              : task.status === "blocked"
              ? "bg-warning/30 border-warning"
              : "border-default-300 hover:border-primary"
          }`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {task.status === "completed" && (
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === "blocked" && (
            <div className="w-1.5 h-0.5 bg-warning rounded" />
          )}
        </div>
        {/* Priority dot */}
        <div
          className={`w-2 h-2 rounded-full cursor-pointer shrink-0 ${priorityDotColors[task.priority]}`}
          onClick={(e) => { e.stopPropagation(); onTogglePriority(task.id, task.priority); }}
          title={`${task.priority} (click to change)`}
        />
        <div className="flex-1 min-w-0" onClick={handleTitleClick}>
          {isEditingTitle ? (
            <Input
              size="sm"
              variant="bordered"
              value={editTitle}
              onValueChange={setEditTitle}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              classNames={{ inputWrapper: "border-1 h-5 min-h-5", input: "text-[11px]" }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className={`text-[11px] sm:text-xs font-medium truncate cursor-text ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
              {task.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {subtasks.length > 0 && (
            <span className="text-[9px] text-default-400">{completedSubs}/{subtasks.length}</span>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="opacity-0 group-hover:opacity-100 w-4 h-4 min-w-4"
            onPress={() => setAddingSubtask(!addingSubtask)}
            title="Add subtask"
          >
            <Plus size={9} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            className="opacity-0 group-hover:opacity-100 w-4 h-4 min-w-4"
            onPress={(e) => { onDelete(task.id); }}
            title="Delete task"
          >
            <Trash2 size={9} />
          </Button>
        </div>
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <DndContext sensors={subtaskSensors} collisionDetection={closestCenter} onDragEnd={handleSubtaskDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {subtasks.map((st) => (
              <SortableSubtaskRow
                key={st.id}
                subtask={st}
                onToggle={() => onToggleSubtask(task.id, st.id)}
                onUpdateTitle={(title) => onUpdateSubtaskTitle(task.id, st.id, title)}
                onDelete={() => onDeleteSubtask(task.id, st.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Inline add subtask */}
      {addingSubtask && (
        <div className="flex items-center gap-1.5 pl-9 pr-2 pb-2">
          <Input
            size="sm"
            variant="bordered"
            placeholder="Subtask..."
            value={newSubtaskTitle}
            onValueChange={setNewSubtaskTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
              if (e.key === "Escape") setAddingSubtask(false);
            }}
            classNames={{ inputWrapper: "border-1 h-6", input: "text-xs" }}
            autoFocus
          />
          <Button size="sm" isIconOnly variant="flat" color="primary" className="w-6 h-6 min-w-6" onPress={handleAddSubtask}>
            <Plus size={10} />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, loading: tasksLoading } = useTasks();
  const { projects } = useProjects();
  const { addTask, updateTask, deleteTask, moveToNextDay, reorderTasks } = useTaskMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<ColumnKey>>(new Set());
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [quickAddTitle, setQuickAddTitle] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("work");
  const [formSubtype, setFormSubtype] = useState<TaskSubtype | "">("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Auto-open edit modal when arriving from dashboard with ?edit=<taskId>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || tasks.length === 0) return;
    const task = tasks.find((t) => t.id === editId);
    if (task) {
      openEditModal(task);
      // Clear the query param so it doesn't reopen on subsequent renders
      router.replace("/tasks");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      result = result.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterCategory !== "all") {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }
    return result;
  }, [tasks, searchQuery, filterCategory, filterPriority, filterStatus]);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnKey, Task[]> = { past: [], yesterday: [], today: [], tomorrow: [], future: [] };
    filteredTasks.forEach((task) => {
      grouped[getColumnForTask(task)].push(task);
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
    setFormSubtype(task.subtype || "");
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
    setFormCategory("work");
    setFormSubtype("");
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
      subtype: formSubtype || undefined,
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

  const addFormSubtask = () => {
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

  const handleAddSubtaskInline = (taskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSub: Subtask = { id: crypto.randomUUID(), title, completed: false };
    updateTask(taskId, { subtasks: [...(task.subtasks || []), newSub] });
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask(taskId, { subtasks: updated });
  };

  const handleReorderSubtasks = (taskId: string, subtasks: Subtask[]) => {
    updateTask(taskId, { subtasks });
  };

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).filter((s) => s.id !== subtaskId);
    updateTask(taskId, { subtasks: updated });
  };

  const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, title } : s
    );
    updateTask(taskId, { subtasks: updated });
  };

  const handleUpdateTitle = (taskId: string, title: string) => {
    updateTask(taskId, { title });
  };

  const handleTogglePriority = (taskId: string, currentPriority: TaskPriority) => {
    const cycle: TaskPriority[] = ["low", "medium", "high"];
    const idx = cycle.indexOf(currentPriority);
    const next = cycle[(idx + 1) % cycle.length];
    updateTask(taskId, { priority: next });
  };

  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim()) return;
    await addTask({
      title: quickAddTitle.trim(),
      status: filterStatus !== "all" ? filterStatus : "not_started",
      priority: filterPriority !== "all" ? filterPriority : "medium",
      category: filterCategory !== "all" ? filterCategory : "work",
      tags: [],
      subtasks: [],
      scheduledDate: Timestamp.fromDate(new Date()),
    });
    setQuickAddTitle("");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column (droppable zone)
    const targetColumn = columns.find((c) => c.key === overId);
    if (targetColumn) {
      // Dropped on empty column area — move task to that column's date
      const task = tasks.find((t) => t.id === activeId);
      if (task) {
        const currentCol = getColumnForTask(task);
        if (currentCol !== targetColumn.key) {
          updateTask(activeId, { scheduledDate: Timestamp.fromDate(getDateForColumn(targetColumn.key)) });
        }
      }
      return;
    }

    // Dropped on another task — check if it's in a different column
    const targetTask = tasks.find((t) => t.id === overId);
    if (targetTask && activeId !== overId) {
      const sourceTask = tasks.find((t) => t.id === activeId);
      if (sourceTask) {
        const sourceCol = getColumnForTask(sourceTask);
        const targetCol = getColumnForTask(targetTask);

        if (sourceCol !== targetCol) {
          // Cross-column: update date to target column's date
          updateTask(activeId, { scheduledDate: Timestamp.fromDate(getDateForColumn(targetCol)) });
        } else {
          // Same column: reorder
          const colTasks = tasksByColumn[sourceCol];
          const oldIdx = colTasks.findIndex((t) => t.id === activeId);
          const newIdx = colTasks.findIndex((t) => t.id === overId);
          if (oldIdx !== -1 && newIdx !== -1) {
            const reordered = arrayMove(colTasks, oldIdx, newIdx);
            reorderTasks(reordered.map((t) => t.id));
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 lg:px-[7%] py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header with search, filters, and quick add in one row */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold mr-1">Tasks</h1>
            <Input
              placeholder="Quick add... (Enter)"
              value={quickAddTitle}
              onValueChange={setQuickAddTitle}
              onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
              variant="bordered"
              size="sm"
              startContent={<Plus size={14} className="text-default-400" />}
              className="w-44 sm:w-56 flex-1 min-w-[150px]"
            />
            <Button color="primary" size="sm" variant="flat" onPress={() => openCreateModal("today")} className="shrink-0">
              + Detailed
            </Button>
            <Input
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Search size={12} className="text-default-400" />}
              variant="bordered"
              size="sm"
              className="w-32 sm:w-40"
            />
            <Select
              size="sm"
              variant="bordered"
              className="w-32"
              aria-label="Category"
              placeholder="Category"
              selectedKeys={[filterCategory]}
              onSelectionChange={(k) => setFilterCategory(Array.from(k)[0] as TaskCategory | "all")}
            >
              {[{ key: "all", label: "All" }, ...categoryOptions].map((c) => (
                <SelectItem key={c.key}>{c.label}</SelectItem>
              ))}
            </Select>
            <Select
              size="sm"
              variant="bordered"
              className="w-32"
              aria-label="Priority"
              placeholder="Priority"
              selectedKeys={[filterPriority]}
              onSelectionChange={(k) => setFilterPriority(Array.from(k)[0] as TaskPriority | "all")}
            >
              {[{ key: "all", label: "All" }, ...priorityOptions].map((c) => (
                <SelectItem key={c.key}>{c.label}</SelectItem>
              ))}
            </Select>
            <Select
              size="sm"
              variant="bordered"
              className="w-32"
              aria-label="Status"
              placeholder="Status"
              selectedKeys={[filterStatus]}
              onSelectionChange={(k) => setFilterStatus(Array.from(k)[0] as TaskStatus | "all")}
            >
              {[{ key: "all", label: "All" }, ...statusOptions].map((c) => (
                <SelectItem key={c.key}>{c.label}</SelectItem>
              ))}
            </Select>
            {(filterCategory !== "all" || filterPriority !== "all" || filterStatus !== "all") && (
              <Button
                size="sm"
                isIconOnly
                variant="light"
                color="danger"
                onPress={() => { setFilterCategory("all"); setFilterPriority("all"); setFilterStatus("all"); }}
              >
                <X size={12} />
              </Button>
            )}
            <span className="text-[10px] text-default-400">{filteredTasks.length}</span>
          </div>

          {/* 5 Columns in One Row */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {columns.map((col) => {
                const colTasks = tasksByColumn[col.key];
                const isCollapsed = collapsedColumns.has(col.key);

                return (
                  <Card key={col.key} shadow="sm" className="h-fit min-w-0">
                    <CardHeader
                      className="flex justify-between items-center px-2 sm:px-3 py-2 cursor-pointer"
                      onClick={() => toggleColumn(col.key)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isCollapsed ? <ChevronRightIcon size={12} /> : <ChevronDown size={12} />}
                        <span className={`font-semibold text-xs sm:text-sm ${col.color} truncate`}>{col.label}</span>
                        <Chip size="sm" variant="flat" className="h-4 text-[10px]">{colTasks.length}</Chip>
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="w-5 h-5 min-w-5"
                        onPress={() => openCreateModal(col.key)}
                      >
                        <Plus size={12} />
                      </Button>
                    </CardHeader>
                    {!isCollapsed && (
                      <CardBody className="pt-0 px-1.5 sm:px-2 pb-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                        <DroppableColumn id={col.key}>
                          <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                            {colTasks.map((task) => (
                              <SortableTask
                                key={task.id}
                                task={task}
                                onToggle={() => updateTask(task.id, { status: task.status === "completed" ? "not_started" : "completed" })}
                                onEdit={() => openEditModal(task)}
                                onDelete={(id) => deleteTask(id)}
                                onAddSubtask={handleAddSubtaskInline}
                                onToggleSubtask={handleToggleSubtask}
                                onDeleteSubtask={handleDeleteSubtask}
                                onReorderSubtasks={handleReorderSubtasks}
                                onUpdateTitle={handleUpdateTitle}
                                onTogglePriority={handleTogglePriority}
                                onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                              />
                            ))}
                          </SortableContext>
                          {colTasks.length === 0 && (
                            <p className="text-default-400 text-[10px] text-center py-4">Drop tasks here</p>
                          )}
                        </DroppableColumn>
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
                  {editingTask && (
                    <Button color="danger" variant="flat" size="sm" className="mr-auto" onPress={() => { deleteTask(editingTask.id); onClose(); }}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  )}
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
