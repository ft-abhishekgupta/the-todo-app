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
  Progress,
  Switch,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Plus,
  Flame,
  TrendingUp,
  Trash2,
  GripVertical,
  Minus,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useHabits, useHabitLogs, useHabitMutations } from "@/hooks/use-habits";
import { HabitCategory, HabitFrequency, HabitType, Habit } from "@/types";
import { format, subDays, eachDayOfInterval } from "date-fns";
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
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

const categoryOptions: { key: HabitCategory; label: string }[] = [
  { key: "morning", label: "🌅 Morning" },
  { key: "all_day", label: "☀️ All Day" },
  { key: "night", label: "🌙 Night" },
  { key: "weekend", label: "📅 Weekend" },
  { key: "month_end", label: "📆 Month End" },
  { key: "quarter_end", label: "🗓️ Quarter End" },
];

const frequencyOptions: { key: HabitFrequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function MiniHeatmap({ habitId }: { habitId: string }) {
  const { logs } = useHabitLogs(habitId, 28);
  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 27), end: today });
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));

  return (
    <div className="flex gap-[2px] flex-wrap">
      {days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        return (
          <div
            key={dateStr}
            className={`w-2 h-2 rounded-[2px] ${completedDates.has(dateStr) ? "bg-success" : "bg-default-100"}`}
          />
        );
      })}
    </div>
  );
}

function SortableHabit({
  habit,
  isCompleted,
  currentCount,
  onToggle,
  onIncrement,
  onDecrement,
  onDelete,
}: {
  habit: Habit;
  isCompleted: boolean;
  currentCount: number;
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: habit.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isCounter = habit.type === "counter";
  const progress = isCounter && habit.targetCount ? Math.min((currentCount / habit.targetCount) * 100, 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border border-divider hover:border-primary/20 transition-all group mb-2 bg-content1"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={14} className="text-default-400" />
      </button>

      {isCounter ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${isCompleted ? "text-success" : ""}`}>
                {habit.title}
              </span>
              {habit.streak > 0 && (
                <Chip size="sm" color="warning" variant="flat" className="h-4 shrink-0" startContent={<Flame size={8} />}>
                  {habit.streak}
                </Chip>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress size="sm" value={progress} color={isCompleted ? "success" : "primary"} className="flex-1 max-w-[150px]" />
              <span className="text-[10px] text-default-500 shrink-0">
                {currentCount}/{habit.targetCount} {habit.unit || ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" isIconOnly variant="flat" className="w-6 h-6 min-w-6" onPress={onDecrement} isDisabled={currentCount <= 0}>
              <Minus size={12} />
            </Button>
            <span className="text-sm font-bold w-6 text-center">{currentCount}</span>
            <Button size="sm" isIconOnly variant="flat" color="primary" className="w-6 h-6 min-w-6" onPress={onIncrement}>
              <Plus size={12} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer shrink-0 transition-all ${
              isCompleted ? "bg-success border-success scale-105" : "border-default-300 hover:border-primary"
            }`}
            onClick={onToggle}
          >
            {isCompleted && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium truncate block ${isCompleted ? "text-default-400 line-through" : ""}`}>
              {habit.title}
            </span>
          </div>
          {habit.streak > 0 && (
            <Chip size="sm" color="warning" variant="flat" className="h-5 shrink-0" startContent={<Flame size={10} />}>
              {habit.streak}
            </Chip>
          )}
        </div>
      )}

      <Button
        isIconOnly
        size="sm"
        variant="light"
        color="danger"
        className="opacity-0 group-hover:opacity-100 shrink-0"
        onPress={onDelete}
      >
        <Trash2 size={12} />
      </Button>
    </div>
  );
}

export default function HabitsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { habits, loading: habitsLoading } = useHabits();
  const { logs } = useHabitLogs(undefined, 30);
  const { addHabit, toggleHabitLog, updateHabitCount, reorderHabits, deleteHabit } = useHabitMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<HabitCategory>("morning");
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>("daily");
  const [formType, setFormType] = useState<HabitType>("checkbox");
  const [formTargetCount, setFormTargetCount] = useState("1");
  const [formUnit, setFormUnit] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory | "all">("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

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
  const filteredHabits = selectedCategory === "all" ? habits : habits.filter((h) => h.category === selectedCategory);
  const completedToday = habits.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === todayDate && l.completed)
  ).length;

  const handleCreateHabit = async () => {
    if (!formTitle.trim()) return;
    await addHabit({
      title: formTitle.trim(),
      category: formCategory,
      frequency: formFrequency,
      type: formType,
      targetCount: formType === "counter" ? parseInt(formTargetCount) || 1 : undefined,
      unit: formType === "counter" ? formUnit.trim() || undefined : undefined,
      order: habits.length,
      isActive: true,
    });
    setFormTitle("");
    setFormUnit("");
    setFormTargetCount("1");
    onOpenChange();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredHabits.findIndex((h) => h.id === active.id);
    const newIdx = filteredHabits.findIndex((h) => h.id === over.id);
    const newOrder = arrayMove(filteredHabits, oldIdx, newIdx);
    reorderHabits(newOrder.map((h) => h.id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Habits</h1>
              <p className="text-default-500 text-xs">
                {completedToday}/{habits.length} today · Best streak: {Math.max(0, ...habits.map((h) => h.longestStreak))}
              </p>
            </div>
            <Button color="primary" size="sm" startContent={<Plus size={16} />} onPress={onOpen}>
              Add
            </Button>
          </div>

          {/* Today's Progress */}
          <Card shadow="sm">
            <CardBody className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Today&apos;s Progress</span>
                <span className="text-xs text-default-500">{completedToday}/{habits.length}</span>
              </div>
              <Progress
                value={habits.length > 0 ? (completedToday / habits.length) * 100 : 0}
                color="success"
                size="md"
              />
            </CardBody>
          </Card>

          {/* Category Filter */}
          <div className="flex gap-1.5 flex-wrap">
            <Chip
              size="sm"
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
                size="sm"
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
          {filteredHabits.length === 0 ? (
            <Card shadow="sm">
              <CardBody className="text-center py-8">
                <p className="text-default-400 text-sm">No habits yet</p>
                <Button color="primary" variant="flat" size="sm" className="mt-2" onPress={onOpen}>
                  Create your first habit
                </Button>
              </CardBody>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={filteredHabits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                {filteredHabits.map((habit) => {
                  const log = logs.find((l) => l.habitId === habit.id && l.date === todayDate);
                  const isCompleted = log?.completed || false;
                  const currentCount = log?.count || 0;
                  return (
                    <SortableHabit
                      key={habit.id}
                      habit={habit}
                      isCompleted={isCompleted}
                      currentCount={currentCount}
                      onToggle={() => toggleHabitLog(habit.id, todayDate, !isCompleted)}
                      onIncrement={() => updateHabitCount(habit.id, todayDate, currentCount + 1, habit.targetCount || 1)}
                      onDecrement={() => updateHabitCount(habit.id, todayDate, Math.max(0, currentCount - 1), habit.targetCount || 1)}
                      onDelete={() => deleteHabit(habit.id)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* Heatmaps */}
          {habits.length > 0 && (
            <Card shadow="sm">
              <CardHeader className="px-4 py-2">
                <span className="text-xs font-semibold">28-Day Activity</span>
              </CardHeader>
              <CardBody className="pt-0 px-4 pb-3 space-y-2">
                {habits.slice(0, 5).map((habit) => (
                  <div key={habit.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-default-500 w-20 truncate">{habit.title}</span>
                    <MiniHeatmap habitId={habit.id} />
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </motion.div>

        {/* Create Habit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Create Habit</ModalHeader>
                <ModalBody className="space-y-3">
                  <Input
                    label="Habit Name"
                    placeholder="e.g., Drink water, Meditate"
                    value={formTitle}
                    onValueChange={setFormTitle}
                    isRequired
                    variant="bordered"
                    size="sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Category" variant="bordered" size="sm" selectedKeys={[formCategory]} onSelectionChange={(k) => setFormCategory(Array.from(k)[0] as HabitCategory)}>
                      {categoryOptions.map((c) => <SelectItem key={c.key}>{c.label}</SelectItem>)}
                    </Select>
                    <Select label="Frequency" variant="bordered" size="sm" selectedKeys={[formFrequency]} onSelectionChange={(k) => setFormFrequency(Array.from(k)[0] as HabitFrequency)}>
                      {frequencyOptions.map((f) => <SelectItem key={f.key}>{f.label}</SelectItem>)}
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-content2">
                    <Switch
                      size="sm"
                      isSelected={formType === "counter"}
                      onValueChange={(v) => setFormType(v ? "counter" : "checkbox")}
                    />
                    <span className="text-sm">Counter habit (track quantity)</span>
                  </div>
                  {formType === "counter" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        label="Target"
                        placeholder="8"
                        value={formTargetCount}
                        onValueChange={setFormTargetCount}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Unit"
                        placeholder="glasses, minutes, pages..."
                        value={formUnit}
                        onValueChange={setFormUnit}
                        variant="bordered"
                        size="sm"
                      />
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
                  <Button color="primary" size="sm" onPress={handleCreateHabit}>Create</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
