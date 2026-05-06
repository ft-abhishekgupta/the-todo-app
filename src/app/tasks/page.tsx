"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Tabs,
  Tab,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Checkbox,
} from "@nextui-org/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  Trash2,
  Edit,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { Task, TaskStatus, TaskPriority, TaskCategory, Subtask } from "@/types";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

const statusOptions: { key: TaskStatus; label: string; color: "default" | "primary" | "success" | "danger" }[] = [
  { key: "not_started", label: "Not Started", color: "default" },
  { key: "started", label: "Started", color: "primary" },
  { key: "completed", label: "Completed", color: "success" },
  { key: "blocked", label: "Blocked", color: "danger" },
];

const priorityOptions: { key: TaskPriority; label: string; color: "default" | "primary" | "warning" | "danger" }[] = [
  { key: "low", label: "Low", color: "default" },
  { key: "medium", label: "Medium", color: "primary" },
  { key: "high", label: "High", color: "warning" },
  { key: "urgent", label: "Urgent", color: "danger" },
];

const categoryOptions: { key: TaskCategory; label: string }[] = [
  { key: "work_projects", label: "Work Projects" },
  { key: "personal_projects", label: "Personal Projects" },
  { key: "habits", label: "Habits" },
  { key: "personal_work", label: "Personal Work" },
  { key: "chores", label: "Chores" },
];

export default function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks, loading: tasksLoading } = useTasks();
  const { projects } = useProjects();
  const { addTask, updateTask, deleteTask, moveToNextDay } = useTaskMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("personal_work");
  const [formDeadline, setFormDeadline] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

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

  const filteredTasks = tasks.filter((task) => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterCategory !== "all" && task.category !== filterCategory) return false;
    return true;
  });

  const openCreateModal = () => {
    setEditingTask(null);
    resetForm();
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
    setFormScheduledDate("");
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
    setFormSubtasks([
      ...formSubtasks,
      { id: crypto.randomUUID(), title: newSubtask.trim(), completed: false },
    ]);
    setNewSubtask("");
  };

  const isOverdue = (task: Task) => {
    if (!task.deadline || task.status === "completed") return false;
    return task.deadline.toDate() < new Date();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Tasks</h1>
              <p className="text-default-500 text-sm">
                {tasks.length} tasks · {tasks.filter((t) => t.status === "completed").length} completed
              </p>
            </div>
            <Button color="primary" startContent={<Plus size={18} />} onPress={openCreateModal}>
              Add Task
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardBody className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<Search size={16} className="text-default-400" />}
                variant="bordered"
                size="sm"
                className="flex-1"
              />
              <Select
                placeholder="Status"
                size="sm"
                variant="bordered"
                className="w-full sm:w-40"
                selectedKeys={[filterStatus]}
                onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as TaskStatus | "all")}
              >
                {[{ key: "all", label: "All Status" }, ...statusOptions].map((s) => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
              <Select
                placeholder="Priority"
                size="sm"
                variant="bordered"
                className="w-full sm:w-40"
                selectedKeys={[filterPriority]}
                onSelectionChange={(keys) => setFilterPriority(Array.from(keys)[0] as TaskPriority | "all")}
              >
                {[{ key: "all", label: "All Priority" }, ...priorityOptions].map((p) => (
                  <SelectItem key={p.key}>{p.label}</SelectItem>
                ))}
              </Select>
              <Select
                placeholder="Category"
                size="sm"
                variant="bordered"
                className="w-full sm:w-44"
                selectedKeys={[filterCategory]}
                onSelectionChange={(keys) => setFilterCategory(Array.from(keys)[0] as TaskCategory | "all")}
              >
                {[{ key: "all", label: "All Categories" }, ...categoryOptions].map((c) => (
                  <SelectItem key={c.key}>{c.label}</SelectItem>
                ))}
              </Select>
            </CardBody>
          </Card>

          {/* Task List */}
          <div className="space-y-2">
            <AnimatePresence>
              {filteredTasks.length === 0 ? (
                <Card>
                  <CardBody className="text-center py-12">
                    <p className="text-default-400">No tasks found</p>
                    <Button
                      color="primary"
                      variant="flat"
                      size="sm"
                      className="mt-3"
                      onPress={openCreateModal}
                    >
                      Create your first task
                    </Button>
                  </CardBody>
                </Card>
              ) : (
                filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`hover:shadow-md transition-shadow ${
                        isOverdue(task) ? "border-l-4 border-l-danger" : ""
                      }`}
                      isPressable
                      onPress={() => openEditModal(task)}
                    >
                      <CardBody className="flex flex-row items-center gap-4 p-4">
                        <Checkbox
                          isSelected={task.status === "completed"}
                          onValueChange={(checked) =>
                            updateTask(task.id, {
                              status: checked ? "completed" : "not_started",
                            })
                          }
                          color="success"
                          size="lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`font-medium truncate ${
                                task.status === "completed"
                                  ? "line-through text-default-400"
                                  : ""
                              }`}
                            >
                              {task.title}
                            </p>
                            {isOverdue(task) && (
                              <Chip size="sm" color="danger" variant="flat">
                                Overdue
                              </Chip>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Chip size="sm" variant="flat" color={priorityOptions.find((p) => p.key === task.priority)?.color}>
                              {task.priority}
                            </Chip>
                            <Chip size="sm" variant="flat">
                              {categoryOptions.find((c) => c.key === task.category)?.label}
                            </Chip>
                            {task.deadline && (
                              <span className="text-xs text-default-400 flex items-center gap-1">
                                <Calendar size={12} />
                                {format(task.deadline.toDate(), "MMM d")}
                              </span>
                            )}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <span className="text-xs text-default-400">
                                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                              </span>
                            )}
                          </div>
                        </div>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu
                            aria-label="Task actions"
                            onAction={(key) => {
                              if (key === "edit") openEditModal(task);
                              if (key === "delete") deleteTask(task.id);
                              if (key === "next-day") {
                                const date = task.scheduledDate?.toDate() || new Date();
                                moveToNextDay(task.id, date);
                              }
                            }}
                          >
                            <DropdownItem key="edit" startContent={<Edit size={14} />}>
                              Edit
                            </DropdownItem>
                            <DropdownItem key="next-day" startContent={<ArrowRight size={14} />}>
                              Move to next day
                            </DropdownItem>
                            <DropdownItem key="delete" color="danger" startContent={<Trash2 size={14} />}>
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </CardBody>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Create/Edit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>
                  {editingTask ? "Edit Task" : "Create Task"}
                </ModalHeader>
                <ModalBody className="space-y-4">
                  <Input
                    label="Title"
                    placeholder="What needs to be done?"
                    value={formTitle}
                    onValueChange={setFormTitle}
                    isRequired
                    variant="bordered"
                  />
                  <Textarea
                    label="Description"
                    placeholder="Add details..."
                    value={formDescription}
                    onValueChange={setFormDescription}
                    variant="bordered"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Status"
                      variant="bordered"
                      selectedKeys={[formStatus]}
                      onSelectionChange={(keys) => setFormStatus(Array.from(keys)[0] as TaskStatus)}
                    >
                      {statusOptions.map((s) => (
                        <SelectItem key={s.key}>{s.label}</SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Priority"
                      variant="bordered"
                      selectedKeys={[formPriority]}
                      onSelectionChange={(keys) => setFormPriority(Array.from(keys)[0] as TaskPriority)}
                    >
                      {priorityOptions.map((p) => (
                        <SelectItem key={p.key}>{p.label}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Category"
                      variant="bordered"
                      selectedKeys={[formCategory]}
                      onSelectionChange={(keys) => setFormCategory(Array.from(keys)[0] as TaskCategory)}
                    >
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.key}>{c.label}</SelectItem>
                      ))}
                    </Select>
                    {projects.length > 0 && (
                      <Select
                        label="Project"
                        variant="bordered"
                        selectedKeys={formProjectId ? [formProjectId] : []}
                        onSelectionChange={(keys) => setFormProjectId(Array.from(keys)[0] as string)}
                      >
                        {projects.map((p) => (
                          <SelectItem key={p.id}>{p.name}</SelectItem>
                        ))}
                      </Select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      label="Deadline"
                      placeholder=" "
                      value={formDeadline}
                      onValueChange={setFormDeadline}
                      variant="bordered"
                    />
                    <Input
                      type="date"
                      label="Scheduled Date"
                      placeholder=" "
                      value={formScheduledDate}
                      onValueChange={setFormScheduledDate}
                      variant="bordered"
                    />
                  </div>
                  <Input
                    label="Tags"
                    placeholder="Comma separated tags"
                    value={formTags}
                    onValueChange={setFormTags}
                    variant="bordered"
                  />
                  <Textarea
                    label="Notes"
                    placeholder="Additional notes..."
                    value={formNotes}
                    onValueChange={setFormNotes}
                    variant="bordered"
                  />

                  {/* Subtasks */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Subtasks</p>
                    {formSubtasks.map((subtask, i) => (
                      <div key={subtask.id} className="flex items-center gap-2">
                        <Checkbox
                          isSelected={subtask.completed}
                          onValueChange={(checked) => {
                            const updated = [...formSubtasks];
                            updated[i] = { ...subtask, completed: checked };
                            setFormSubtasks(updated);
                          }}
                          size="sm"
                        />
                        <span className={`text-sm flex-1 ${subtask.completed ? "line-through text-default-400" : ""}`}>
                          {subtask.title}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => setFormSubtasks(formSubtasks.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        size="sm"
                        placeholder="Add subtask..."
                        value={newSubtask}
                        onValueChange={setNewSubtask}
                        onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                        variant="bordered"
                      />
                      <Button size="sm" variant="flat" onPress={addSubtask}>
                        Add
                      </Button>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button color="primary" onPress={handleSubmit}>
                    {editingTask ? "Update" : "Create"}
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
