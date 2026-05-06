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
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useTasks } from "@/hooks/use-tasks";
import { useHabitLogs } from "@/hooks/use-habits";
import { Task } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";

const priorityColors: Record<string, string> = {
  low: "bg-default-300",
  medium: "bg-primary",
  high: "bg-warning",
  urgent: "bg-danger",
};

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks } = useTasks();
  const { logs } = useHabitLogs(undefined, 60);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => {
      if (task.scheduledDate) {
        return isSameDay(task.scheduledDate.toDate(), date);
      }
      if (task.deadline) {
        return isSameDay(task.deadline.toDate(), date);
      }
      return false;
    });
  };

  const getHabitCompletionsForDate = (date: Date): number => {
    const dateStr = format(date, "yyyy-MM-dd");
    return logs.filter((l) => l.date === dateStr && l.completed).length;
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Calendar</h1>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                variant="light"
                onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft size={18} />
              </Button>
              <span className="font-semibold min-w-[150px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight size={18} />
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_300px] gap-6">
            {/* Calendar Grid */}
            <Card>
              <CardBody className="p-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-default-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const dayTasks = getTasksForDate(day);
                    const habitCount = getHabitCompletionsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[80px] p-1 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : isToday(day)
                            ? "border-primary/50 bg-primary/5"
                            : "border-divider hover:bg-content2"
                        } ${!isCurrentMonth ? "opacity-40" : ""}`}
                        onClick={() => setSelectedDate(day)}
                      >
                        <div className="flex justify-between items-start">
                          <span
                            className={`text-xs font-medium ${
                              isToday(day) ? "text-primary font-bold" : ""
                            }`}
                          >
                            {format(day, "d")}
                          </span>
                          {habitCount > 0 && (
                            <div className="w-2 h-2 rounded-full bg-success" />
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className={`text-[10px] px-1 py-0.5 rounded truncate ${
                                task.status === "completed"
                                  ? "bg-success/20 text-success-600"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[10px] text-default-400 px-1">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Selected Date Detail */}
            <Card>
              <CardHeader>
                <span className="font-semibold text-sm">
                  {selectedDate
                    ? format(selectedDate, "EEEE, MMMM d")
                    : "Select a date"}
                </span>
              </CardHeader>
              <CardBody className="space-y-2 pt-0">
                {!selectedDate ? (
                  <p className="text-default-400 text-sm">
                    Click on a date to see details
                  </p>
                ) : selectedDateTasks.length === 0 ? (
                  <p className="text-default-400 text-sm">
                    No tasks on this date
                  </p>
                ) : (
                  selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg bg-content2 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      <div className="flex gap-1">
                        <Chip size="sm" variant="flat">
                          {task.status.replace("_", " ")}
                        </Chip>
                        <Chip size="sm" variant="flat" color={
                          task.priority === "high" ? "warning" :
                          task.priority === "medium" ? "primary" : "default"
                        }>
                          {task.priority}
                        </Chip>
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
