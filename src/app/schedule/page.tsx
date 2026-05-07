"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useSchedule, useScheduleMutations } from "@/hooks/use-schedule";
import { format, addDays, subDays, parseISO, startOfWeek } from "date-fns";
import { ScheduleEvent } from "@/types";
import { formatTimeStr } from "@/lib/time";
import toast from "react-hot-toast";

const EVENT_TYPES = [
  { key: "event", label: "Event", color: "bg-blue-500" },
  { key: "work", label: "Work", color: "bg-purple-500" },
  { key: "personal", label: "Personal", color: "bg-green-500" },
  { key: "growth", label: "Growth", color: "bg-orange-500" },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_MIN = 1; // 1px per minute = 60px per hour
const TIMELINE_HEIGHT = 24 * 60 * PX_PER_MIN;
const EMPTY_ID_SET: ReadonlySet<string> = new Set();

function getEventColor(type: string) {
  return EVENT_TYPES.find((t) => t.key === type)?.color || "bg-blue-500";
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function snapTo5(mins: number): number {
  return Math.round(mins / 5) * 5;
}

// Renders a single day's vertical timeline column (no hour labels — those live in the shared gutter).
// Owns its own Firestore listener via useSchedule(date) and its own drag-to-create state.
// Event move/duplicate/delete is coordinated by the parent via callbacks because dragging an
// event across columns (week view) requires a shared drag session at parent level.
function DayTimeline({
  date,
  timeFmt,
  compact,
  hiddenEventIds,
  suppressHover,
  registerColumn,
  onCreate,
  onEdit,
  onEventPointerDown,
  onEventContextMenu,
}: {
  date: string;
  timeFmt: "12h" | "24h";
  compact: boolean;
  hiddenEventIds: ReadonlySet<string>;
  suppressHover: boolean;
  registerColumn: (date: string, el: HTMLDivElement | null) => void;
  onCreate: (date: string, startMin: number, endMin: number) => void;
  onEdit: (event: ScheduleEvent) => void;
  onEventPointerDown: (event: ScheduleEvent, e: React.PointerEvent) => void;
  onEventContextMenu: (event: ScheduleEvent, e: React.MouseEvent) => void;
}) {
  const { events } = useSchedule(date);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  // Register this column's element with the parent so the parent can hit-test
  // pointer position against day columns during cross-column event drags.
  useEffect(() => {
    registerColumn(date, contentRef.current);
    return () => registerColumn(date, null);
  }, [date, registerColumn]);

  const isToday = date === format(new Date(), "yyyy-MM-dd");
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, [isToday]);

  const getMinutesFromY = (clientY: number): number => {
    if (!contentRef.current) return 0;
    const rect = contentRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return snapTo5(Math.max(0, Math.min(24 * 60 - 5, Math.floor(y / PX_PER_MIN))));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const mins = getMinutesFromY(e.clientY);
    setIsDragging(true);
    setDragStart(mins);
    setDragEnd(mins + 30);
    setHoverMin(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && dragStart !== null) {
      const mins = getMinutesFromY(e.clientY);
      setDragEnd(Math.max(dragStart + 5, mins));
      return;
    }
    if (suppressHover) {
      if (hoverMin !== null) setHoverMin(null);
      return;
    }
    if ((e.target as HTMLElement).closest("[data-event]")) {
      if (hoverMin !== null) setHoverMin(null);
      return;
    }
    setHoverMin(getMinutesFromY(e.clientY));
  };

  const handlePointerLeave = () => {
    setHoverMin(null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* no-op */ }
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    onCreate(date, start, end);
  };

  const dragPreview = (() => {
    if (dragStart === null || dragEnd === null) return null;
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    return { top: start * PX_PER_MIN, height: (end - start) * PX_PER_MIN, start, end };
  })();

  const showHover = hoverMin !== null && !isDragging && !suppressHover;

  return (
    <div
      ref={contentRef}
      className="relative border-l border-default-100 select-none touch-none"
      style={{ height: `${TIMELINE_HEIGHT}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* Hour grid lines */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-default-100"
          style={{ top: `${hour * 60 * PX_PER_MIN}px`, height: `${60 * PX_PER_MIN}px` }}
        />
      ))}
      {/* 5-min grid lines (lighter) */}
      {HOURS.map((hour) =>
        [15, 30, 45].map((min) => (
          <div
            key={`${hour}-${min}`}
            className="absolute left-0 right-0 border-t border-default-50"
            style={{ top: `${(hour * 60 + min) * PX_PER_MIN}px` }}
          />
        ))
      )}

      {/* Now marker */}
      {isToday && (
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{ top: `${nowMinutes * PX_PER_MIN}px` }}
        >
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-danger -ml-1 ring-2 ring-background" />
            <div className="flex-1 h-0.5 bg-danger" />
          </div>
        </div>
      )}

      {/* 5-min hover preview */}
      {showHover && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: `${hoverMin! * PX_PER_MIN}px` }}
        >
          <div className="flex items-center">
            <span className="text-[9px] font-semibold text-primary bg-background/90 px-1 rounded-sm tabular-nums -ml-1">
              {formatTimeStr(minutesToTime(hoverMin!), timeFmt)}
            </span>
            <div className="flex-1 h-px bg-primary/60 border-t border-dashed border-primary/60" />
          </div>
        </div>
      )}

      {/* Drag preview */}
      {isDragging && dragPreview && (
        <div
          className="absolute left-1 right-1 bg-primary/20 border-2 border-primary/50 rounded-md pointer-events-none z-10"
          style={{ top: `${dragPreview.top}px`, height: `${dragPreview.height}px` }}
        >
          <span className="text-[10px] text-primary font-medium px-1.5">
            {formatTimeStr(minutesToTime(dragPreview.start), timeFmt)} - {formatTimeStr(minutesToTime(dragPreview.end), timeFmt)}
          </span>
        </div>
      )}

      {/* Events */}
      <div className="absolute left-1 right-1 top-0 bottom-0">
        {events.filter((event) => !hiddenEventIds.has(event.id)).map((event) => {
          const startMins = timeToMinutes(event.startTime);
          const endMins = timeToMinutes(event.endTime);
          const top = startMins * PX_PER_MIN;
          const height = Math.max((endMins - startMins) * PX_PER_MIN, 15);
          return (
            <div
              key={event.id}
              data-event
              className={`absolute left-0 right-0 rounded-md px-1.5 py-0.5 border border-white/20 overflow-hidden group ${getEventColor(event.type)} text-white z-20 cursor-grab active:cursor-grabbing`}
              style={{ top: `${top}px`, height: `${height}px` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.button !== 0) return;
                onEventPointerDown(event, e);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEventContextMenu(event, e);
              }}
            >
              <div className="flex items-center justify-between gap-1 pointer-events-none">
                <span className="text-xs font-medium truncate">{event.title}</span>
              </div>
              {height >= 24 && (
                <span className="text-[10px] opacity-80 block truncate pointer-events-none">
                  {formatTimeStr(event.startTime, timeFmt)} - {formatTimeStr(event.endTime, timeFmt)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const timeFmt = userProfile?.timeFormat || "12h";
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { addEvent, updateEvent, deleteEvent, duplicateSchedule } = useScheduleMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isDupOpen, onOpen: onDupOpen, onOpenChange: onDupOpenChange } = useDisclosure();

  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formType, setFormType] = useState<ScheduleEvent["type"]>("event");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [dupTargetDate, setDupTargetDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));

  // Cross-column event drag (move) coordination ----------------------------------
  type DragSession = {
    event: ScheduleEvent;
    durationMin: number;
    pointerStartX: number;
    pointerStartY: number;
    pointerOffsetMin: number; // pointer offset (mins) inside event at drag start
    started: boolean;
    currentTopMin: number;
    currentDate: string;
  };
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragSessionRef = useRef<DragSession | null>(null);
  const [dragSnapshot, setDragSnapshot] = useState<{
    eventId: string;
    title: string;
    type: ScheduleEvent["type"];
    topMin: number;
    durationMin: number;
    date: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    event: ScheduleEvent;
    x: number;
    y: number;
  } | null>(null);

  const registerColumn = useCallback((d: string, el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(d, el);
    else columnRefs.current.delete(d);
  }, []);

  // Refs used by global pointer listeners so they always see the latest functions
  // without re-attaching window listeners on every render.
  const handlersRef = useRef<{
    openEdit: (e: ScheduleEvent) => void;
    updateEvent: typeof updateEvent;
  }>({ openEdit: () => {}, updateEvent });

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const s = dragSessionRef.current;
      if (!s) return;
      if (!s.started) {
        const dx = e.clientX - s.pointerStartX;
        const dy = e.clientY - s.pointerStartY;
        if (dx * dx + dy * dy < 16) return; // 4px threshold
        s.started = true;
      }
      // Determine target date column by hit-testing clientX against registered columns.
      let targetDate: string | null = null;
      let targetRect: DOMRect | null = null;
      columnRefs.current.forEach((el, d) => {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) {
          targetDate = d;
          targetRect = r;
        }
      });
      // If pointer is outside all columns, retain last valid target.
      const refRect: DOMRect | undefined =
        targetRect ?? columnRefs.current.get(s.currentDate)?.getBoundingClientRect();
      if (!refRect) return;
      if (targetDate) s.currentDate = targetDate;
      const rawTopMin = (e.clientY - refRect.top) / PX_PER_MIN - s.pointerOffsetMin;
      const maxTop = 24 * 60 - s.durationMin;
      const snapped = Math.max(0, Math.min(maxTop, snapTo5(rawTopMin)));
      s.currentTopMin = snapped;
      setDragSnapshot({
        eventId: s.event.id,
        title: s.event.title,
        type: s.event.type,
        topMin: snapped,
        durationMin: s.durationMin,
        date: s.currentDate,
      });
    };
    const onPointerUp = () => {
      const s = dragSessionRef.current;
      if (!s) return;
      dragSessionRef.current = null;
      if (!s.started) {
        setDragSnapshot(null);
        handlersRef.current.openEdit(s.event);
        return;
      }
      const newStart = s.currentTopMin;
      const newEnd = s.currentTopMin + s.durationMin;
      // Only commit if something actually changed
      const startTimeStr = minutesToTime(newStart);
      const endTimeStr = minutesToTime(newEnd);
      if (
        startTimeStr !== s.event.startTime ||
        endTimeStr !== s.event.endTime ||
        s.currentDate !== s.event.date
      ) {
        handlersRef.current.updateEvent(s.event.id, {
          date: s.currentDate,
          startTime: startTimeStr,
          endTime: endTimeStr,
        });
      }
      setDragSnapshot(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  // Close context menu on outside click or Escape.
  useEffect(() => {
    if (!contextMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-context-menu]")) return;
      setContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

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

  const navigateDate = (direction: number) => {
    const step = viewMode === "week" ? 7 : 1;
    const base = parseISO(selectedDate);
    const d = direction > 0 ? addDays(base, step) : subDays(base, step);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), "yyyy-MM-dd")
  );

  const handleColumnCreate = (date: string, startMin: number, endMin: number) => {
    setEditingEvent(null);
    setFormDate(date);
    setFormTitle("");
    setFormStartTime(minutesToTime(startMin));
    setFormEndTime(minutesToTime(endMin));
    setFormType("event");
    setFormNotes("");
    onOpen();
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormDate(selectedDate);
    setFormTitle("");
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormType("event");
    setFormNotes("");
    onOpen();
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setFormDate(event.date);
    setFormTitle(event.title);
    setFormStartTime(event.startTime);
    setFormEndTime(event.endTime);
    setFormType(event.type);
    setFormNotes(event.notes || "");
    onOpen();
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    if (timeToMinutes(formEndTime) <= timeToMinutes(formStartTime)) {
      toast.error("End time must be after start time");
      return;
    }
    const data = {
      title: formTitle.trim(),
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      type: formType,
      notes: formNotes.trim() || undefined,
    };

    if (editingEvent) {
      await updateEvent(editingEvent.id, data);
    } else {
      await addEvent(data as any);
    }
    onOpenChange();
  };

  const handleDuplicate = async () => {
    await duplicateSchedule(selectedDate, dupTargetDate);
    onDupOpenChange();
  };

  // Begin moving an event (pointerdown). The actual drag math runs from the
  // window-level pointer listeners installed once at mount.
  const handleEventPointerDown = (event: ScheduleEvent, e: React.PointerEvent) => {
    if (isOpen || isDupOpen) return;
    const colEl = columnRefs.current.get(event.date);
    if (!colEl) return;
    const colRect = colEl.getBoundingClientRect();
    const pointerMin = snapTo5(
      Math.max(0, Math.min(24 * 60 - 5, Math.floor((e.clientY - colRect.top) / PX_PER_MIN)))
    );
    const startMin = timeToMinutes(event.startTime);
    const endMin = timeToMinutes(event.endTime);
    dragSessionRef.current = {
      event,
      durationMin: Math.max(5, endMin - startMin),
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      pointerOffsetMin: pointerMin - startMin,
      started: false,
      currentTopMin: startMin,
      currentDate: event.date,
    };
    setContextMenu(null);
  };

  const handleEventContextMenu = (event: ScheduleEvent, e: React.MouseEvent) => {
    if (isOpen || isDupOpen) return;
    setContextMenu({ event, x: e.clientX, y: e.clientY });
  };

  const handleDuplicateEvent = async (event: ScheduleEvent) => {
    setContextMenu(null);
    const payload = {
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
      notes: event.notes,
    } as Omit<ScheduleEvent, "id" | "userId" | "createdAt" | "updatedAt">;
    await addEvent(payload);
  };

  const handleDeleteFromMenu = async (event: ScheduleEvent) => {
    setContextMenu(null);
    await deleteEvent(event.id);
  };

  // Keep a stable ref to the latest handlers so the global pointer listeners
  // (registered once) always call the current openEdit/updateEvent without
  // closing over a stale closure.
  handlersRef.current = { openEdit, updateEvent };

  const hiddenEventIds: ReadonlySet<string> = dragSnapshot ? new Set([dragSnapshot.eventId]) : EMPTY_ID_SET;
  const suppressHover = isOpen || isDupOpen || dragSnapshot !== null || contextMenu !== null;

  // Compute drag-ghost CSS coordinates relative to the document so the ghost can
  // be rendered as a fixed-position overlay regardless of scroll position.
  const ghost = (() => {
    if (!dragSnapshot) return null;
    const col = columnRefs.current.get(dragSnapshot.date);
    if (!col) return null;
    const r = col.getBoundingClientRect();
    return {
      left: r.left + 4,
      width: r.width - 8,
      top: r.top + dragSnapshot.topMin * PX_PER_MIN,
      height: dragSnapshot.durationMin * PX_PER_MIN,
    };
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 lg:px-[7%] py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-primary" />
              <h1 className="text-xl font-bold">Schedule</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" onPress={onDupOpen} startContent={<Copy size={14} />}>
                Duplicate
              </Button>
              <Button size="sm" color="primary" onPress={openCreate} startContent={<Plus size={14} />}>
                Add Event
              </Button>
            </div>
          </div>

          {/* Date Navigation */}
          <Card shadow="sm">
            <CardBody className="flex flex-row items-center justify-between p-3 gap-2">
              <Button isIconOnly size="sm" variant="light" onPress={() => navigateDate(-1)}>
                <ChevronLeft size={16} />
              </Button>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <Input
                  type="date"
                  size="sm"
                  variant="bordered"
                  value={selectedDate}
                  onValueChange={setSelectedDate}
                  classNames={{ inputWrapper: "border-1 h-8" }}
                  className="w-40"
                />
                {viewMode === "day" ? (
                  <span className="text-sm font-medium text-default-600">
                    {format(parseISO(selectedDate), "EEEE")}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-default-600">
                    {format(parseISO(weekDates[0]), "MMM d")} – {format(parseISO(weekDates[6]), "MMM d, yyyy")}
                  </span>
                )}
                {selectedDate === format(new Date(), "yyyy-MM-dd") && (
                  <Chip size="sm" color="primary" variant="flat">Today</Chip>
                )}
                <div className="flex bg-default-100 rounded-md p-0.5">
                  <Button
                    size="sm"
                    variant={viewMode === "day" ? "solid" : "light"}
                    color={viewMode === "day" ? "primary" : "default"}
                    className="h-7 px-3 min-w-0"
                    onPress={() => setViewMode("day")}
                  >
                    Day
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "week" ? "solid" : "light"}
                    color={viewMode === "week" ? "primary" : "default"}
                    className="h-7 px-3 min-w-0"
                    onPress={() => setViewMode("week")}
                  >
                    Week
                  </Button>
                </div>
              </div>
              <Button isIconOnly size="sm" variant="light" onPress={() => navigateDate(1)}>
                <ChevronRight size={16} />
              </Button>
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card shadow="sm">
            <CardHeader className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-sm font-semibold">
                {viewMode === "day" ? format(parseISO(selectedDate), "EEEE, MMM d") : "Week view"}
              </span>
              <span className="text-[10px] text-default-400">Drag on a column to create</span>
            </CardHeader>
            <CardBody className="px-0 py-0">
              {viewMode === "week" && (
                <div
                  className="grid border-b border-default-100 bg-default-50/60 sticky top-0 z-10"
                  style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
                >
                  <div />
                  {weekDates.map((d) => {
                    const isTodayCol = d === format(new Date(), "yyyy-MM-dd");
                    return (
                      <button
                        key={d}
                        onClick={() => { setSelectedDate(d); setViewMode("day"); }}
                        className={`px-1 py-1.5 text-center border-l border-default-100 hover:bg-default-100 transition-colors ${isTodayCol ? "text-primary font-semibold" : "text-default-600"}`}
                      >
                        <div className="text-[10px] uppercase tracking-wide">{format(parseISO(d), "EEE")}</div>
                        <div className="text-sm font-medium">{format(parseISO(d), "d")}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="relative overflow-y-auto max-h-[calc(100vh-280px)]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns:
                      viewMode === "week" ? `56px repeat(7, minmax(0, 1fr))` : `56px 1fr`,
                  }}
                >
                  {/* Time gutter */}
                  <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-default-100"
                        style={{ top: `${hour * 60 * PX_PER_MIN}px`, height: `${60 * PX_PER_MIN}px` }}
                      >
                        <span className="text-[10px] text-default-400 px-2 py-0.5 block">
                          {formatTimeStr(`${String(hour).padStart(2, "0")}:00`, timeFmt)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Day column(s) */}
                  {(viewMode === "week" ? weekDates : [selectedDate]).map((d) => (
                    <DayTimeline
                      key={d}
                      date={d}
                      timeFmt={timeFmt}
                      compact={viewMode === "week"}
                      hiddenEventIds={hiddenEventIds}
                      suppressHover={suppressHover}
                      registerColumn={registerColumn}
                      onCreate={handleColumnCreate}
                      onEdit={openEdit}
                      onEventPointerDown={handleEventPointerDown}
                      onEventContextMenu={handleEventContextMenu}
                    />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Create/Edit Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>{editingEvent ? "Edit Event" : "New Event"}</ModalHeader>
                <ModalBody>
                  <div className="space-y-3">
                    <Input
                      label="Title"
                      variant="bordered"
                      size="sm"
                      value={formTitle}
                      onValueChange={setFormTitle}
                      autoFocus
                    />
                    <Input
                      type="date"
                      label="Date"
                      variant="bordered"
                      size="sm"
                      value={formDate}
                      onValueChange={setFormDate}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="time"
                        label="Start"
                        variant="bordered"
                        size="sm"
                        value={formStartTime}
                        onValueChange={setFormStartTime}
                      />
                      <Input
                        type="time"
                        label="End"
                        variant="bordered"
                        size="sm"
                        value={formEndTime}
                        onValueChange={setFormEndTime}
                      />
                    </div>
                    <Select
                      label="Type"
                      variant="bordered"
                      size="sm"
                      selectedKeys={[formType]}
                      onSelectionChange={(k) => setFormType(Array.from(k)[0] as ScheduleEvent["type"])}
                    >
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t.key}>{t.label}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      label="Notes"
                      variant="bordered"
                      size="sm"
                      value={formNotes}
                      onValueChange={setFormNotes}
                      placeholder="Optional"
                    />
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>Cancel</Button>
                  <Button color="primary" onPress={handleSubmit}>
                    {editingEvent ? "Update" : "Create"}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Duplicate Modal */}
        <Modal isOpen={isDupOpen} onOpenChange={onDupOpenChange} size="sm">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Duplicate Schedule</ModalHeader>
                <ModalBody>
                  <p className="text-sm text-default-500 mb-2">
                    Copy all events from {format(new Date(selectedDate), "MMM d")} to:
                  </p>
                  <Input
                    type="date"
                    label="Target Date"
                    variant="bordered"
                    size="sm"
                    value={dupTargetDate}
                    onValueChange={setDupTargetDate}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>Cancel</Button>
                  <Button color="primary" onPress={handleDuplicate}>Duplicate</Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Drag ghost overlay (rendered while moving an event) */}
        {ghost && dragSnapshot && (
          <div
            className={`fixed pointer-events-none rounded-md ${EVENT_TYPES.find((t) => t.key === dragSnapshot.type)?.color || "bg-blue-500"} text-white text-xs px-2 py-1 shadow-lg opacity-90 z-50 ring-2 ring-white/60`}
            style={{
              left: ghost.left,
              width: ghost.width,
              top: ghost.top,
              height: ghost.height,
            }}
          >
            <div className="font-medium truncate">{dragSnapshot.title}</div>
            <div className="opacity-90">
              {formatTimeStr(minutesToTime(dragSnapshot.topMin), timeFmt)} -{" "}
              {formatTimeStr(minutesToTime(dragSnapshot.topMin + dragSnapshot.durationMin), timeFmt)}
            </div>
          </div>
        )}

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            data-context-menu
            className="fixed z-50 min-w-[140px] rounded-md border border-default-200 bg-content1 shadow-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-default-100"
              onClick={() => handleDuplicateEvent(contextMenu.event)}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger-50"
              onClick={() => handleDeleteFromMenu(contextMenu.event)}
            >
              Delete
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
