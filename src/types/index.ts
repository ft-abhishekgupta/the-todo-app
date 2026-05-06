import { Timestamp } from "firebase/firestore";

// Task Types
export type TaskStatus = "not_started" | "started" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskType = "work" | "personal" | "growth" | "habit";

export type WorkSubtype = "project_task" | "general_task" | "chores";
export type PersonalSubtype = "general_task" | "project_task" | "chores" | "social";
export type GrowthSubtype = "professional_learning" | "personal_learning" | "improvement";

export type TaskSubtype = WorkSubtype | PersonalSubtype | GrowthSubtype;

// Keep TaskCategory as an alias for backward compatibility
export type TaskCategory = TaskType;

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
  subtype?: TaskSubtype;
  projectId?: string;
  deadline?: Timestamp;
  scheduledDate?: Timestamp;
  recurrence?: RecurrenceRule;
  tags: string[];
  notes?: string;
  subtasks: Subtask[];
  isFocus?: boolean;
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
export type HabitType = "checkbox" | "counter";

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  type: HabitType;
  targetCount?: number; // For counter habits (e.g., 8 glasses of water)
  unit?: string; // e.g., "glasses", "minutes", "pages"
  targetDays?: number[]; // For weekly habits
  streak: number;
  longestStreak: number;
  order: number;
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
  count?: number; // For counter habits
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
