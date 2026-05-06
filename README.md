# TheTodoApp - Advanced Productivity System

A production-ready, scalable productivity web application built with Next.js (App Router) and Firebase.

## Features

### 🗂️ Task Management
- Full CRUD with status, priority, category, deadlines
- Subtasks support
- Scheduled dates & recurring tasks
- Overdue highlighting
- Move tasks to next day
- Filter & search

### 📊 Unified Dashboard
- Live clock
- Focus task (top priority)
- Today's tasks overview
- Habit checklist
- Pomodoro stats
- Quick add task

### 🔥 Habit Tracker
- Categories: Morning, All Day, Night, Weekend, Month/Quarter End
- Streak tracking with visualization
- GitHub-style heatmap
- Completion analytics

### ⏱️ Pomodoro Timer
- Configurable timer (25/5 default)
- Start/pause/reset
- Session notes while running
- Link sessions to tasks
- Daily session tracking

### 📅 Calendar View
- Monthly view with task indicators
- Date selection detail panel
- Habit completion dots

### 📁 Project Management
- Group tasks under projects
- Progress tracking with percentages
- Color coding
- Project deadlines

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** NextUI + Tailwind CSS
- **Backend:** Firebase (Firestore + Auth)
- **State:** React Query + React hooks
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Icons:** Lucide React

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project with Firestore and Authentication enabled

### Setup

1. Clone the repository:
```bash
git clone https://github.com/ft-abhishekgupta/the-todo-app.git
cd the-todo-app
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` with your Firebase config:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Enable Firestore indexes (required):
   - Go to Firebase Console > Firestore > Indexes
   - Create composite indexes for:
     - `tasks`: userId (asc) + order (asc)
     - `habits`: userId (asc) + isActive (asc) + createdAt (asc)
     - `projects`: userId (asc) + isActive (asc) + createdAt (desc)
     - `pomodoroSessions`: userId (asc) + startedAt (asc)
     - `habitLogs`: userId (asc) + date (asc)

5. Run the development server:
```bash
npm run dev
```

## Firebase Data Model

```
users/{userId}
  - email, displayName, photoURL
  - pomodoroSettings: { workDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak }

tasks/{taskId}
  - userId, title, description, status, priority, category
  - projectId?, deadline?, scheduledDate?, recurrence?
  - tags[], subtasks[], notes, order
  - createdAt, updatedAt

habits/{habitId}
  - userId, title, description, category, frequency
  - streak, longestStreak, isActive
  - createdAt, updatedAt

habitLogs/{logId}
  - userId, habitId, date, completed
  - createdAt

pomodoroSessions/{sessionId}
  - userId, taskId?, duration, notes
  - startedAt, completedAt?, isCompleted

projects/{projectId}
  - userId, name, description, color, deadline?
  - isActive, createdAt, updatedAt
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Main dashboard
│   ├── tasks/             # Task management
│   ├── habits/            # Habit tracker
│   ├── pomodoro/          # Pomodoro timer
│   ├── calendar/          # Calendar view
│   ├── projects/          # Project management
│   └── login/             # Authentication
├── components/
│   └── layout/            # Navbar, ThemeSwitch
├── config/
│   ├── firebase.ts        # Firebase initialization
│   └── site.ts            # Site configuration
├── hooks/
│   ├── use-tasks.ts       # Task CRUD operations
│   ├── use-habits.ts      # Habit operations + streak logic
│   ├── use-pomodoro.ts    # Timer + session management
│   └── use-projects.ts    # Project CRUD
├── providers/
│   ├── index.tsx          # Combined providers
│   └── auth-provider.tsx  # Firebase Auth context
└── types/
    └── index.ts           # TypeScript definitions
```

## License

MIT
