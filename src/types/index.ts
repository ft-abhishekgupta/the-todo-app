import { Timestamp } from "firebase/firestore";

// Task Types
export type TaskStatus = "not_started" | "started" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskCategory =
  | "work_projects"
  | "personal_projects"
  | "habits"
  | "personal_work"
  | "chores";

export type RecurrenceRule = {
  type: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  daysOfWeek?: number[]; // 0-6
  dayOfMonth?: number;
};

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  projectId?: string;
  deadline?: Timestamp;
  scheduledDate?: Timestamp;
  recurrence?: RecurrenceRule;
  tags: string[];
  notes?: string;
  subtasks: Subtask[];
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

// Habit Types
export type HabitCategory =
  | "morning"
  | "all_day"
  | "night"
  | "weekend"
  | "month_end"
  | "quarter_end";

export type HabitFrequency = "daily" | "weekly" | "monthly";

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  targetDays?: number[]; // For weekly habits
  streak: number;
  longestStreak: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  completed: boolean;
  createdAt: Timestamp;
}

// Pomodoro Types
export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string;
  duration: number; // in minutes
  notes?: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  isCompleted: boolean;
}

// Project Types
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  deadline?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  pomodoroSettings: PomodoroSettings;
  createdAt: Timestamp;
}

export interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}
