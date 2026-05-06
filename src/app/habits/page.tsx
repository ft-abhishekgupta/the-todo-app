"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
  Select,
  SelectItem,
  Textarea,
  Progress,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Plus, Flame, TrendingUp, Calendar, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { HabitCategory, HabitFrequency, Habit } from "@/types";
import { format, subDays, eachDayOfInterval } from "date-fns";

const categoryOptions: { key: HabitCategory; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "all_day", label: "All Day" },
  { key: "night", label: "Night" },
  { key: "weekend", label: "Weekend" },
  { key: "month_end", label: "Month End" },
  { key: "quarter_end", label: "Quarter End" },
];

const frequencyOptions: { key: HabitFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function HabitHeatmap({ habitId }: { habitId: string }) {
  const { logs } = useHabitLogs(habitId, 90);
  const today = new Date();
  const days = eachDayOfInterval({
    start: subDays(today, 83),
    end: today,
  });

  const completedDates = new Set(
    logs.filter((l) => l.completed).map((l) => l.date)
  );

  return (
    <div className="flex gap-0.5 flex-wrap">
      {days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const isCompleted = completedDates.has(dateStr);
        return (
          <div
            key={dateStr}
            className={`w-3 h-3 rounded-sm ${
              isCompleted
                ? "bg-success"
                : "bg-default-100 dark:bg-default-50"
            }`}
            title={`${dateStr}: ${isCompleted ? "Completed" : "Not done"}`}
          />
        );
      })}
    </div>
  );
}

export default function HabitsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { habits, loading: habitsLoading } = useHabits();
  const { logs } = useHabitLogs(undefined, 30);
  const { addHabit, toggleHabitLog, deleteHabit } = useHabitMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<HabitCategory>("morning");
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>("daily");
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory | "all">("all");

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

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const filteredHabits =
    selectedCategory === "all"
      ? habits
      : habits.filter((h) => h.category === selectedCategory);

  const completedToday = habits.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === todayDate && l.completed)
  ).length;

  const handleCreateHabit = async () => {
    if (!formTitle.trim()) return;
    await addHabit({
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      category: formCategory,
      frequency: formFrequency,
      isActive: true,
    });
    setFormTitle("");
    setFormDescription("");
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
              <h1 className="text-2xl font-bold">Habits</h1>
              <p className="text-default-500 text-sm">
                {completedToday}/{habits.length} completed today
              </p>
            </div>
            <Button color="primary" startContent={<Plus size={18} />} onPress={onOpen}>
              Add Habit
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-success/10">
                  <Flame size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Best Streak</p>
                  <p className="text-xl font-bold">
                    {Math.max(0, ...habits.map((h) => h.longestStreak))}
                  </p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Today</p>
                  <p className="text-xl font-bold">
                    {habits.length > 0
                      ? Math.round((completedToday / habits.length) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Calendar size={20} className="text-warning" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Active Habits</p>
                  <p className="text-xl font-bold">{habits.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-xs text-default-500 mb-2">Today&apos;s Progress</p>
                <Progress
                  value={habits.length > 0 ? (completedToday / habits.length) * 100 : 0}
                  color="success"
                  className="mt-1"
                />
              </CardBody>
            </Card>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Chip
              variant={selectedCategory === "all" ? "solid" : "bordered"}
              color="primary"
              className="cursor-pointer"
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Chip>
            {categoryOptions.map((cat) => (
              <Chip
                key={cat.key}
                variant={selectedCategory === cat.key ? "solid" : "bordered"}
                color="primary"
                className="cursor-pointer"
                onClick={() => setSelectedCategory(cat.key)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>

          {/* Habit List */}
          <div className="space-y-3">
            {filteredHabits.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <p className="text-default-400">No habits found</p>
                  <Button
                    color="primary"
                    variant="flat"
                    size="sm"
                    className="mt-3"
                    onPress={onOpen}
                  >
                    Create your first habit
                  </Button>
                </CardBody>
              </Card>
            ) : (
              filteredHabits.map((habit) => {
                const isCompleted = logs.some(
                  (l) => l.habitId === habit.id && l.date === todayDate && l.completed
                );
                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardBody className="p-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-6 h-6 mt-0.5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                              isCompleted
                                ? "bg-success border-success scale-110"
                                : "border-default-300 hover:border-primary"
                            }`}
                            onClick={() => toggleHabitLog(habit.id, todayDate, !isCompleted)}
                          >
                            {isCompleted && (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className={`font-medium ${isCompleted ? "text-default-400" : ""}`}>
                                  {habit.title}
                                </h3>
                                {habit.description && (
                                  <p className="text-default-500 text-xs">{habit.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {habit.streak > 0 && (
                                  <Chip size="sm" color="warning" variant="flat" startContent={<Flame size={12} />}>
                                    {habit.streak} day streak
                                  </Chip>
                                )}
                                <Chip size="sm" variant="flat">
                                  {categoryOptions.find((c) => c.key === habit.category)?.label}
                                </Chip>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onPress={() => deleteHabit(habit.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                            <HabitHeatmap habitId={habit.id} />
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Create Habit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create Habit</ModalHeader>
                <ModalBody className="space-y-4">
                  <Input
                    label="Habit Name"
                    placeholder="e.g., Meditate for 10 minutes"
                    value={formTitle}
                    onValueChange={setFormTitle}
                    isRequired
                    variant="bordered"
                  />
                  <Textarea
                    label="Description"
                    placeholder="Optional description..."
                    value={formDescription}
                    onValueChange={setFormDescription}
                    variant="bordered"
                  />
                  <Select
                    label="Category"
                    variant="bordered"
                    selectedKeys={[formCategory]}
                    onSelectionChange={(keys) => setFormCategory(Array.from(keys)[0] as HabitCategory)}
                  >
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.key}>{c.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="Frequency"
                    variant="bordered"
                    selectedKeys={[formFrequency]}
                    onSelectionChange={(keys) => setFormFrequency(Array.from(keys)[0] as HabitFrequency)}
                  >
                    {frequencyOptions.map((f) => (
                      <SelectItem key={f.key}>{f.label}</SelectItem>
                    ))}
                  </Select>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button color="primary" onPress={handleCreateHabit}>
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
