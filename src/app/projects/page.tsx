"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Progress,
  Chip,
  Select,
  SelectItem,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Plus,
  FolderOpen,
  Trash2,
  Calendar,
  ArrowLeft,
  Edit3,
  CheckCircle2,
  Clock,
  Pause,
  FileText,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { SortableTaskItem } from "@/components/task/sortable-task-item";
import { TaskEditModal } from "@/components/task/task-edit-modal";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { Project, ProjectType, ProjectStatus, Task, TaskPriority, Subtask } from "@/types";
import { Timestamp } from "firebase/firestore";
import { format, isPast } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const projectColors = [
  "#0072F5", "#17c964", "#f5a524", "#f31260",
  "#7828c8", "#06b7db", "#ff6b6b", "#4ecdc4",
];

const projectTypeOptions = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "growth", label: "Growth" },
];

const projectStatusOptions = [
  { key: "active", label: "Active", icon: Clock, color: "primary" },
  { key: "on_hold", label: "On Hold", icon: Pause, color: "warning" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "success" },
];

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { projects, loading: projectsLoading } = useProjects();
  const { tasks } = useTasks();
  const { addTask, updateTask, reorderTasks } = useTaskMutations();
  const { addProject, updateProject, deleteProject } = useProjectMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onOpenChange: onEditOpenChange } = useDisclosure();
  const { isOpen: isTaskEditOpen, onOpen: onTaskEditOpen, onOpenChange: onTaskEditOpenChange } = useDisclosure();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formColor, setFormColor] = useState(projectColors[0]);
  const [formType, setFormType] = useState<ProjectType>("work");
  const [formNotes, setFormNotes] = useState("");

  // Detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

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

  const getProjectTasks = (projectId: string) => tasks.filter((t) => t.projectId === projectId);

  const getProjectProgress = (projectId: string) => {
    const pt = getProjectTasks(projectId);
    if (pt.length === 0) return 0;
    return Math.round((pt.filter((t) => t.status === "completed").length / pt.length) * 100);
  };

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (filterType !== "all") filtered = filtered.filter((p) => p.type === filterType);
    if (filterStatus !== "all") filtered = filtered.filter((p) => (p.status || "active") === filterStatus);
    return filtered;
  }, [projects, filterType, filterStatus]);

  const handleCreateProject = async () => {
    if (!formName.trim()) return;
    await addProject({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      notes: formNotes.trim() || undefined,
      color: formColor,
      type: formType,
      status: "active",
      deadline: formDeadline ? Timestamp.fromDate(new Date(formDeadline)) : undefined,
      isActive: true,
    });
    resetForm();
    onOpenChange();
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormDeadline("");
    setFormColor(projectColors[0]);
    setFormType("work");
    setFormNotes("");
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setFormName(project.name);
    setFormDescription(project.description || "");
    setFormDeadline(project.deadline ? format(project.deadline.toDate(), "yyyy-MM-dd") : "");
    setFormColor(project.color);
    setFormType(project.type || "work");
    setFormNotes(project.notes || "");
    onEditOpen();
  };

  const handleUpdateProject = async () => {
    if (!selectedProject || !formName.trim()) return;
    await updateProject(selectedProject.id, {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      notes: formNotes.trim() || undefined,
      color: formColor,
      type: formType,
      deadline: formDeadline ? Timestamp.fromDate(new Date(formDeadline)) : undefined,
    });
    onEditOpenChange();
    resetForm();
  };

  const handleStatusChange = async (projectId: string, status: ProjectStatus) => {
    await updateProject(projectId, { status });
  };

  const handleSaveNotes = async (projectId: string) => {
    await updateProject(projectId, { notes: notesValue });
    setEditingNotes(false);
  };

  const handleToggleTask = async (task: Task) => {
    await updateTask(task.id, { status: task.status === "completed" ? "not_started" : "completed" });
  };

  const handleTaskToggleByIdAndCompleted = (id: string, completed: boolean) => {
    updateTask(id, { status: completed ? "completed" : "not_started" });
  };

  const handleAddSubtaskToTask = (taskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSubtask: Subtask = { id: crypto.randomUUID(), title, completed: false };
    updateTask(taskId, { subtasks: [...(task.subtasks || []), newSubtask] });
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

  const handleUpdateTaskTitle = (taskId: string, title: string) => {
    updateTask(taskId, { title });
  };

  const handleTogglePriority = (taskId: string, currentPriority: TaskPriority) => {
    const cycle: TaskPriority[] = ["low", "medium", "high"];
    const idx = cycle.indexOf(currentPriority);
    const next = cycle[(idx + 1) % cycle.length];
    updateTask(taskId, { priority: next });
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    onTaskEditOpen();
  };

  const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, title } : s
    );
    updateTask(taskId, { subtasks: updated });
  };

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleProjectTaskDragEnd = (event: DragEndEvent, projectActiveTasks: Task[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = projectActiveTasks.findIndex((t) => t.id === active.id);
    const newIdx = projectActiveTasks.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(projectActiveTasks, oldIdx, newIdx);
    reorderTasks(newOrder.map((t) => t.id));
  };

  const handleQuickAddTask = async (projectId: string, projectType: ProjectType) => {
    const title = quickTaskTitle.trim();
    if (!title) return;
    await addTask({
      title,
      status: "not_started",
      priority: "medium",
      category: projectType,
      projectId,
      subtasks: [],
      tags: [],
    });
    setQuickTaskTitle("");
  };

  // Detail view for a selected project
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const detailProject = projects.find((p) => p.id === detailProjectId);
  const detailTasks = detailProjectId ? getProjectTasks(detailProjectId) : [];
  const activeTasks = detailTasks.filter((t) => t.status !== "completed");
  const completedTasks = detailTasks.filter((t) => t.status === "completed");

  if (detailProject) {
    const progress = getProjectProgress(detailProject.id);
    const isOverdue = detailProject.deadline && isPast(detailProject.deadline.toDate());

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto max-w-full px-3 sm:px-4 py-4 sm:py-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Back + Header */}
            <div className="flex items-center gap-3">
              <Button isIconOnly variant="light" size="sm" onPress={() => setDetailProjectId(null)}>
                <ArrowLeft size={18} />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: detailProject.color }} />
                  <h1 className="text-xl font-bold truncate">{detailProject.name}</h1>
                  <Chip size="sm" variant="flat" color={projectTypeOptions.find((t) => t.key === (detailProject.type || "work"))?.key === "work" ? "primary" : detailProject.type === "personal" ? "success" : "warning"}>
                    {detailProject.type || "work"}
                  </Chip>
                </div>
                {detailProject.description && (
                  <p className="text-default-500 text-sm mt-0.5">{detailProject.description}</p>
                )}
              </div>
              <Button size="sm" variant="flat" startContent={<Edit3 size={14} />} onPress={() => openEditModal(detailProject)}>
                Edit
              </Button>
            </div>

            {/* Progress & Meta */}
            <Card shadow="sm">
              <CardBody className="p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 w-full">
                    <Progress
                      value={progress}
                      color={progress === 100 ? "success" : "primary"}
                      showValueLabel
                      label={`${completedTasks.length}/${detailTasks.length} tasks completed`}
                      className="max-w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {detailProject.deadline && (
                      <Chip size="sm" color={isOverdue ? "danger" : "default"} variant="flat" startContent={<Calendar size={10} />}>
                        {format(detailProject.deadline.toDate(), "MMM d, yyyy")}
                      </Chip>
                    )}
                    <Select
                      size="sm"
                      variant="bordered"
                      className="w-32"
                      selectedKeys={[(detailProject.status || "active")]}
                      onSelectionChange={(k) => handleStatusChange(detailProject.id, Array.from(k)[0] as ProjectStatus)}
                    >
                      {projectStatusOptions.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                    </Select>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Tabs: Tasks | Notes */}
            <Tabs aria-label="Project sections" color="primary" variant="underlined">
              <Tab key="tasks" title={`Tasks (${detailTasks.length})`}>
                <div className="space-y-3 mt-3">
                  {/* Quick add task */}
                  <Card shadow="sm">
                    <CardBody className="p-2">
                      <div className="flex gap-2">
                        <Input
                          size="sm"
                          placeholder="Add a task to this project..."
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleQuickAddTask(detailProject.id, detailProject.type || "work");
                            }
                          }}
                          startContent={<Plus size={14} className="text-default-400" />}
                        />
                        <Button
                          size="sm"
                          color="primary"
                          isDisabled={!quickTaskTitle.trim()}
                          onPress={() => handleQuickAddTask(detailProject.id, detailProject.type || "work")}
                        >
                          Add
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Active Tasks */}
                  {activeTasks.length > 0 && (
                    <Card shadow="sm">
                      <CardHeader className="pb-1 px-3 pt-2">
                        <span className="text-sm font-semibold">Active ({activeTasks.length})</span>
                      </CardHeader>
                      <CardBody className="pt-1 px-3 pb-2">
                        <DndContext
                          sensors={taskSensors}
                          collisionDetection={closestCenter}
                          modifiers={[restrictToVerticalAxis]}
                          onDragEnd={(e) => handleProjectTaskDragEnd(e, activeTasks)}
                        >
                          <SortableContext items={activeTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                            {activeTasks.map((task) => (
                              <SortableTaskItem
                                key={task.id}
                                task={task}
                                onToggle={handleTaskToggleByIdAndCompleted}
                                onAddSubtask={handleAddSubtaskToTask}
                                onToggleSubtask={handleToggleSubtask}
                                onReorderSubtasks={handleReorderSubtasks}
                                onUpdateTitle={handleUpdateTaskTitle}
                                onTogglePriority={handleTogglePriority}
                                onOpenEditModal={handleOpenEditModal}
                                onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </CardBody>
                    </Card>
                  )}

                  {/* Completed Tasks */}
                  {completedTasks.length > 0 && (
                    <Card shadow="sm">
                      <CardHeader className="pb-1 px-3 pt-2">
                        <span className="text-sm font-semibold text-success">Completed ({completedTasks.length})</span>
                      </CardHeader>
                      <CardBody className="pt-1 px-3 pb-2">
                        <DndContext
                          sensors={taskSensors}
                          collisionDetection={closestCenter}
                          modifiers={[restrictToVerticalAxis]}
                        >
                          <SortableContext items={completedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                            {completedTasks.map((task) => (
                              <SortableTaskItem
                                key={task.id}
                                task={task}
                                onToggle={handleTaskToggleByIdAndCompleted}
                                onAddSubtask={handleAddSubtaskToTask}
                                onToggleSubtask={handleToggleSubtask}
                                onReorderSubtasks={handleReorderSubtasks}
                                onUpdateTitle={handleUpdateTaskTitle}
                                onTogglePriority={handleTogglePriority}
                                onOpenEditModal={handleOpenEditModal}
                                onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </CardBody>
                    </Card>
                  )}

                  {detailTasks.length === 0 && (
                    <Card shadow="sm">
                      <CardBody className="text-center py-8">
                        <p className="text-default-400 text-sm">No tasks assigned to this project yet.</p>
                        <p className="text-default-300 text-xs mt-1">Use the input above to add a task, or assign existing tasks from the Tasks page.</p>
                      </CardBody>
                    </Card>
                  )}
                </div>
              </Tab>

              <Tab key="notes" title="Notes">
                <div className="mt-3">
                  <Card shadow="sm">
                    <CardBody className="p-3">
                      {editingNotes ? (
                        <div className="space-y-2">
                          <Textarea
                            variant="bordered"
                            value={notesValue}
                            onValueChange={setNotesValue}
                            minRows={6}
                            placeholder="Project notes, links, references..."
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="flat" onPress={() => setEditingNotes(false)}>Cancel</Button>
                            <Button size="sm" color="primary" onPress={() => handleSaveNotes(detailProject.id)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="min-h-[120px] cursor-pointer hover:bg-content2 rounded-lg p-2 transition-colors"
                          onClick={() => { setNotesValue(detailProject.notes || ""); setEditingNotes(true); }}
                        >
                          {detailProject.notes ? (
                            <p className="text-sm whitespace-pre-wrap">{detailProject.notes}</p>
                          ) : (
                            <p className="text-default-300 text-sm italic">Click to add project notes...</p>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              </Tab>

              <Tab key="details" title="Details">
                <div className="mt-3 space-y-3">
                  <Card shadow="sm">
                    <CardBody className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-default-400 text-xs">Type</p>
                          <p className="font-medium capitalize">{detailProject.type || "work"}</p>
                        </div>
                        <div>
                          <p className="text-default-400 text-xs">Status</p>
                          <p className="font-medium capitalize">{detailProject.status || "active"}</p>
                        </div>
                        <div>
                          <p className="text-default-400 text-xs">Created</p>
                          <p className="font-medium">{format(detailProject.createdAt.toDate(), "MMM d, yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-default-400 text-xs">Deadline</p>
                          <p className="font-medium">{detailProject.deadline ? format(detailProject.deadline.toDate(), "MMM d, yyyy") : "None"}</p>
                        </div>
                        <div>
                          <p className="text-default-400 text-xs">Total Tasks</p>
                          <p className="font-medium">{detailTasks.length}</p>
                        </div>
                        <div>
                          <p className="text-default-400 text-xs">Completion</p>
                          <p className="font-medium">{progress}%</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Button color="danger" variant="flat" className="w-full" startContent={<Trash2 size={14} />} onPress={() => { deleteProject(detailProject.id); setDetailProjectId(null); }}>
                    Archive Project
                  </Button>
                </div>
              </Tab>
            </Tabs>
          </motion.div>
        </main>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header with title, filters, and new project in one row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2">
              <h1 className="text-lg font-bold leading-none">Projects</h1>
              <p className="text-default-500 text-[10px]">{projects.length} total</p>
            </div>
            <Select size="sm" variant="bordered" className="w-32" aria-label="Type" placeholder="Type" selectedKeys={[filterType]} onSelectionChange={(k) => setFilterType(Array.from(k)[0] as string)}>
              <SelectItem key="all">All Types</SelectItem>
              <SelectItem key="work">Work</SelectItem>
              <SelectItem key="personal">Personal</SelectItem>
              <SelectItem key="growth">Growth</SelectItem>
            </Select>
            <Select size="sm" variant="bordered" className="w-32" aria-label="Status" placeholder="Status" selectedKeys={[filterStatus]} onSelectionChange={(k) => setFilterStatus(Array.from(k)[0] as string)}>
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="on_hold">On Hold</SelectItem>
              <SelectItem key="completed">Completed</SelectItem>
            </Select>
            <span className="text-[10px] text-default-400">{filteredProjects.length}</span>
            <div className="flex-1" />
            <Button color="primary" size="sm" startContent={<Plus size={14} />} onPress={onOpen} className="shrink-0">
              New Project
            </Button>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <FolderOpen size={48} className="mx-auto text-default-300 mb-4" />
                <p className="text-default-400">No projects yet</p>
                <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={onOpen}>
                  Create your first project
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProjects.map((project) => {
                const projectTasks = getProjectTasks(project.id);
                const progress = getProjectProgress(project.id);
                const completedCount = projectTasks.filter((t) => t.status === "completed").length;
                const isOverdue = project.deadline && isPast(project.deadline.toDate()) && (project.status || "active") !== "completed";
                const typeColor = project.type === "work" ? "primary" : project.type === "personal" ? "success" : "warning";

                return (
                  <Card
                    key={project.id}
                    shadow="sm"
                    className="cursor-pointer hover:border-primary/30 border border-transparent transition-all"
                    isPressable
                    onPress={() => setDetailProjectId(project.id)}
                  >
                    <CardBody className="p-3 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                          <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Chip size="sm" variant="flat" color={typeColor} className="h-5 text-[10px]">
                            {project.type || "work"}
                          </Chip>
                          {(project.status || "active") !== "active" && (
                            <Chip size="sm" variant="dot" color={(project.status === "completed" ? "success" : "warning") as "success" | "warning"} className="h-5 text-[10px]">
                              {project.status}
                            </Chip>
                          )}
                        </div>
                      </div>

                      {project.description && (
                        <p className="text-default-500 text-xs line-clamp-2">{project.description}</p>
                      )}

                      <Progress
                        size="sm"
                        value={progress}
                        color={progress === 100 ? "success" : "primary"}
                        className="max-w-full"
                      />
                      <div className="flex items-center justify-between text-[11px] text-default-400">
                        <span>{completedCount}/{projectTasks.length} tasks</span>
                        {project.deadline && (
                          <span className={isOverdue ? "text-danger font-medium" : ""}>
                            {isOverdue ? "Overdue · " : ""}
                            {format(project.deadline.toDate(), "MMM d")}
                          </span>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Create Project Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create Project</ModalHeader>
                <ModalBody className="space-y-3">
                  <Input label="Project Name" placeholder="e.g., Website Redesign" value={formName} onValueChange={setFormName} isRequired variant="bordered" size="sm" />
                  <Textarea label="Description" placeholder="What's this project about?" value={formDescription} onValueChange={setFormDescription} variant="bordered" size="sm" minRows={2} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Type" variant="bordered" size="sm" selectedKeys={[formType]} onSelectionChange={(k) => setFormType(Array.from(k)[0] as ProjectType)}>
                      {projectTypeOptions.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                    </Select>
                    <Input type="date" label="Deadline (optional)" value={formDeadline} onValueChange={setFormDeadline} variant="bordered" size="sm" />
                  </div>
                  <Textarea label="Notes" placeholder="Project notes, links, references..." value={formNotes} onValueChange={setFormNotes} variant="bordered" size="sm" minRows={3} />
                  <div>
                    <p className="text-xs font-medium mb-2">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {projectColors.map((color) => (
                        <div
                          key={color}
                          className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${formColor === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
                  <Button color="primary" size="sm" onPress={handleCreateProject}>Create</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Edit Project Modal */}
        <Modal isOpen={isEditOpen} onOpenChange={onEditOpenChange} size="lg">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Edit Project</ModalHeader>
                <ModalBody className="space-y-3">
                  <Input label="Project Name" value={formName} onValueChange={setFormName} isRequired variant="bordered" size="sm" />
                  <Textarea label="Description" value={formDescription} onValueChange={setFormDescription} variant="bordered" size="sm" minRows={2} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Type" variant="bordered" size="sm" selectedKeys={[formType]} onSelectionChange={(k) => setFormType(Array.from(k)[0] as ProjectType)}>
                      {projectTypeOptions.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                    </Select>
                    <Input type="date" label="Deadline" value={formDeadline} onValueChange={setFormDeadline} variant="bordered" size="sm" />
                  </div>
                  <Textarea label="Notes" value={formNotes} onValueChange={setFormNotes} variant="bordered" size="sm" minRows={3} />
                  <div>
                    <p className="text-xs font-medium mb-2">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {projectColors.map((color) => (
                        <div
                          key={color}
                          className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${formColor === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
                  <Button color="primary" size="sm" onPress={handleUpdateProject}>Save</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        <TaskEditModal
          isOpen={isTaskEditOpen}
          onOpenChange={onTaskEditOpenChange}
          task={editingTask}
        />
      </main>
    </div>
  );
}
