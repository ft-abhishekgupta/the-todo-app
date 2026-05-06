"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Trash2, Calendar } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

const projectColors = [
  "#0072F5",
  "#17c964",
  "#f5a524",
  "#f31260",
  "#7828c8",
  "#06b7db",
  "#ff6b6b",
  "#4ecdc4",
];

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { projects, loading: projectsLoading } = useProjects();
  const { tasks } = useTasks();
  const { addProject, deleteProject } = useProjectMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formColor, setFormColor] = useState(projectColors[0]);

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

  const getProjectTasks = (projectId: string) => {
    return tasks.filter((t) => t.projectId === projectId);
  };

  const getProjectProgress = (projectId: string) => {
    const projectTasks = getProjectTasks(projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  const handleCreateProject = async () => {
    if (!formName.trim()) return;
    await addProject({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      color: formColor,
      deadline: formDeadline ? Timestamp.fromDate(new Date(formDeadline)) : undefined,
      isActive: true,
    });
    setFormName("");
    setFormDescription("");
    setFormDeadline("");
    onOpenChange();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-default-500 text-sm">
                {projects.length} active projects
              </p>
            </div>
            <Button color="primary" startContent={<Plus size={18} />} onPress={onOpen}>
              New Project
            </Button>
          </div>

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <FolderOpen size={48} className="mx-auto text-default-300 mb-4" />
                <p className="text-default-400">No projects yet</p>
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="mt-3"
                  onPress={onOpen}
                >
                  Create your first project
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const projectTasks = getProjectTasks(project.id);
                const progress = getProjectProgress(project.id);
                const completedCount = projectTasks.filter(
                  (t) => t.status === "completed"
                ).length;

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="h-full">
                      <CardHeader className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <div>
                            <h3 className="font-semibold">{project.name}</h3>
                            {project.description && (
                              <p className="text-default-500 text-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => deleteProject(project.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </CardHeader>
                      <CardBody className="pt-0 space-y-3">
                        <Progress
                          value={progress}
                          color={progress === 100 ? "success" : "primary"}
                          showValueLabel
                          label={`${completedCount}/${projectTasks.length} tasks`}
                          className="max-w-full"
                        />
                        {project.deadline && (
                          <div className="flex items-center gap-1 text-xs text-default-400">
                            <Calendar size={12} />
                            <span>Due {format(project.deadline.toDate(), "MMM d, yyyy")}</span>
                          </div>
                        )}
                        <div className="flex gap-1 flex-wrap">
                          {projectTasks
                            .filter((t) => t.status !== "completed")
                            .slice(0, 3)
                            .map((task) => (
                              <Chip key={task.id} size="sm" variant="flat">
                                {task.title.substring(0, 20)}
                              </Chip>
                            ))}
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Create Project Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create Project</ModalHeader>
                <ModalBody className="space-y-4">
                  <Input
                    label="Project Name"
                    placeholder="e.g., Website Redesign"
                    value={formName}
                    onValueChange={setFormName}
                    isRequired
                    variant="bordered"
                  />
                  <Textarea
                    label="Description"
                    placeholder="What's this project about?"
                    value={formDescription}
                    onValueChange={setFormDescription}
                    variant="bordered"
                  />
                  <Input
                    type="date"
                    label="Deadline (optional)"
                    placeholder=" "
                    value={formDeadline}
                    onValueChange={setFormDeadline}
                    variant="bordered"
                  />
                  <div>
                    <p className="text-sm font-medium mb-2">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {projectColors.map((color) => (
                        <div
                          key={color}
                          className={`w-8 h-8 rounded-full cursor-pointer transition-transform ${
                            formColor === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button color="primary" onPress={handleCreateProject}>
                    Create
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
