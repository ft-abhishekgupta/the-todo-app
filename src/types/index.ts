import { Timestamp } from "firebase/firestore";

// Task Types
export type TaskStatus = "not_started" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high";

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

export type HabitFrequency = "daily" | "weekly" | "monthly" | "custom";
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
  customDays?: number[]; // For frequency=custom (Sun=0..Sat=6)
  weekendDays?: number[]; // Override for weekend window (default [5,6,0,1])
  monthEndStartDay?: number; // Default 28
  monthEndEndDay?: number; // Default 5 (of next month)
  quarterEndStartDay?: number; // Default 15 (of last month of quarter)
  quarterEndEndDay?: number; // Default 7 (of first month of next quarter)
  color?: string; // Tailwind color name (primary/success/warning/secondary/danger)
  icon?: string; // Optional emoji
  reminderTime?: string; // "HH:mm"
  streak: number;
  longestStreak: number;
  order: number;
  isActive: boolean;
  isPaused?: boolean;
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
export type PomodoroMode = "focus" | "short_break" | "long_break";

export interface PomodoroSession {
  id: string;
  userId: string;
  taskId?: string;
  taskIds?: string[];
  habitIds?: string[];
  duration: number; // planned, in minutes
  notes?: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  isCompleted: boolean;
  mode?: PomodoroMode;
  skipped?: boolean;
  actualDurationSeconds?: number;
}

// Project Types
export type ProjectType = "work" | "personal" | "growth";
export type ProjectStatus = "active" | "completed" | "on_hold";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  notes?: string;
  color: string;
  type: ProjectType;
  status: ProjectStatus;
  deadline?: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Schedule Types
export interface ScheduleEvent {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: "event" | "work" | "personal" | "growth" | "task" | "habit";
  color?: string;
  linkedTaskId?: string;
  linkedHabitId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  pomodoroSettings: PomodoroSettings;
  timeFormat?: "12h" | "24h";
  focusTaskIds?: string[];
  focusHabitId?: string;
  createdAt: Timestamp;
}

export interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

// Lists (bucket lists, etc.)
export interface ListItem {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  url?: string;
  createdAt: Timestamp;
}

export interface UserList {
  id: string;
  userId: string;
  name: string;
  category: string; // dynamic, e.g. "Media", "Travel"
  description?: string;
  color: string;
  icon?: string; // lucide icon name
  items: ListItem[];
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Tracker Types
export type TrackerFrequency = "daily" | "weekly" | "monthly";
// "manual": user enters values directly.
// "habits_completed" / "tasks_completed" / "pomodoro": value auto-derived from existing data.
export type TrackerSource = "manual" | "habits_completed" | "tasks_completed" | "pomodoro" | "schedule";
export type TrackerAggregation = "last" | "sum" | "average";
export type PomodoroTrackerMetric = "sessions" | "focus_minutes";
export type ScheduleTrackerMetric = "minutes" | "hours" | "count";
export type ScheduleEventType = "event" | "work" | "personal" | "growth" | "task" | "habit";

export interface TrackerFilters {
  habitCategories?: HabitCategory[];
  habitIds?: string[];
  taskCategories?: TaskCategory[];
  taskSubtypes?: TaskSubtype[];
  projectIds?: string[];
  pomodoroMetric?: PomodoroTrackerMetric;
  scheduleEventTypes?: ScheduleEventType[];
  scheduleMetric?: ScheduleTrackerMetric;
}

export interface TrackerField {
  id: string;
  label: string;
  unit?: string;
  color?: string; // tailwind color name
  target?: number;
}

export interface Tracker {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string; // emoji
  color: string; // tailwind color name
  frequency: TrackerFrequency;
  source: TrackerSource;
  fields: TrackerField[]; // For manual trackers; auto-source uses [{ id: "value", label: "Count" }]
  aggregation?: TrackerAggregation; // How to roll up multiple values in a period (manual). Default "last".
  filters?: TrackerFilters;
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TrackerEntry {
  id: string;
  trackerId: string;
  userId: string;
  // Period key: daily=YYYY-MM-DD, weekly=YYYY-Www (ISO week, Mon start), monthly=YYYY-MM
  periodKey: string;
  values: Record<string, number>;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
