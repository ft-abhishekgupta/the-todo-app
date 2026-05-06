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
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  ArrowRight,
  GripVertical,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Filter,
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { Task, TaskStatus, TaskPriority, TaskCategory, Subtask } from "@/types";
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
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "growth", label: "Growth" },
];

type ColumnKey = "past" | "yesterday" | "today" | "tomorrow" | "future";

function getColumnForTask(task: Task): ColumnKey {
  if (!task.scheduledDate) return "today";
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
}: {
  subtask: Subtask;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

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
      <span className={`text-xs truncate ${subtask.completed ? "line-through text-default-400" : "text-default-600"}`}>
        {subtask.title}
      </span>
    </div>
  );
}

function SortableTask({
  task,
  onToggle,
  onEdit,
  onDelete,
  onMoveNext,
  onAddSubtask,
  onToggleSubtask,
  onReorderSubtasks,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNext: () => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-content1 border border-divider hover:border-primary/30 rounded-lg transition-all mb-2"
    >
      <div className="flex items-start gap-2 p-2 group">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 touch-none shrink-0">
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
          <p className={`text-xs sm:text-sm font-medium truncate cursor-pointer ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Chip size="sm" variant="flat" color={priorityOptions.find((p) => p.key === task.priority)?.color} className="h-4 text-[10px]">
              {task.priority}
            </Chip>
            <Chip size="sm" variant="flat" className="h-4 text-[10px]">{task.category}</Chip>
            {subtasks.length > 0 && (
              <span className="text-[10px] text-default-400">{completedSubs}/{subtasks.length}</span>
            )}
            {task.deadline && (
              <span className="text-[10px] text-default-400">📅 {format(task.deadline.toDate(), "MMM d")}</span>
            )}
          </div>
          {subtasks.length > 0 && (
            <Progress size="sm" value={(completedSubs / subtasks.length) * 100} color="primary" className="mt-1 max-w-[100px]" />
          )}
        </div>
        <div className="flex items-center shrink-0">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5"
            onPress={() => setAddingSubtask(!addingSubtask)}
            title="Add subtask"
          >
            <Plus size={10} />
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5 shrink-0">
                <MoreVertical size={12} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Task actions">
              <DropdownItem key="edit" startContent={<Edit size={12} />} onPress={onEdit}>Edit</DropdownItem>
              <DropdownItem key="next" startContent={<ArrowRight size={12} />} onPress={onMoveNext}>Move to next day</DropdownItem>
              <DropdownItem key="delete" color="danger" startContent={<Trash2 size={12} />} onPress={onDelete}>Delete</DropdownItem>
            </DropdownMenu>
          </Dropdown>
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
  const { user, loading } = useAuth();
  const router = useRouter();
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
  const [showFilters, setShowFilters] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("work");
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
      <main className="container mx-auto max-w-full px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
              <p className="text-default-500 text-xs">
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
              <Button
                size="sm"
                variant={showFilters ? "flat" : "bordered"}
                color={showFilters || filterCategory !== "all" || filterPriority !== "all" || filterStatus !== "all" ? "primary" : "default"}
                startContent={<Filter size={14} />}
                onPress={() => setShowFilters(!showFilters)}
              >
                Filter
              </Button>
              <Button color="primary" size="sm" startContent={<Plus size={16} />} onPress={() => openCreateModal("today")}>
                Add
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-content2/50 border border-divider">
              <Select
                size="sm"
                variant="bordered"
                className="w-28"
                label="Category"
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
                className="w-28"
                label="Priority"
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
                className="w-28"
                label="Status"
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
                  variant="light"
                  color="danger"
                  startContent={<X size={12} />}
                  onPress={() => { setFilterCategory("all"); setFilterPriority("all"); setFilterStatus("all"); }}
                >
                  Clear
                </Button>
              )}
              <span className="text-xs text-default-400 ml-auto">{filteredTasks.length} tasks</span>
            </div>
          )}

          {/* 5 Columns in One Row */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                                onDelete={() => deleteTask(task.id)}
                                onMoveNext={() => moveToNextDay(task.id, task.scheduledDate?.toDate() || new Date())}
                                onAddSubtask={handleAddSubtaskInline}
                                onToggleSubtask={handleToggleSubtask}
                                onReorderSubtasks={handleReorderSubtasks}
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
                      <Input size="sm" placeholder="Add subtask..." value={newSubtask} onValueChange={setNewSubtask} onKeyDown={(e) => e.key === "Enter" && addFormSubtask()} variant="bordered" />
                      <Button size="sm" variant="flat" onPress={addFormSubtask}>Add</Button>
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
