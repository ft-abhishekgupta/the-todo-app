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
import { format, addDays, subDays } from "date-fns";
import { ScheduleEvent } from "@/types";
import { formatTimeStr } from "@/lib/time";

const EVENT_TYPES = [
  { key: "event", label: "Event", color: "bg-blue-500" },
  { key: "work", label: "Work", color: "bg-primary" },
  { key: "personal", label: "Personal", color: "bg-green-500" },
  { key: "growth", label: "Growth", color: "bg-orange-500" },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_MIN = 1; // 1px per minute = 60px per hour

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

export default function SchedulePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const timeFmt = userProfile?.timeFormat || "12h";
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { events, loading: eventsLoading } = useSchedule(selectedDate);
  const { addEvent, updateEvent, deleteEvent, duplicateSchedule } = useScheduleMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isDupOpen, onOpen: onDupOpen, onOpenChange: onDupOpenChange } = useDisclosure();

  // Live current-minutes ticker for the "now" red line
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formType, setFormType] = useState<ScheduleEvent["type"]>("event");
  const [formNotes, setFormNotes] = useState("");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [dupTargetDate, setDupTargetDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));

  // Drag-to-create state
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

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
    const d = direction > 0 ? addDays(new Date(selectedDate), 1) : subDays(new Date(selectedDate), 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const getMinutesFromY = (clientY: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top + timelineRef.current.scrollTop;
    return snapTo5(Math.max(0, Math.min(24 * 60 - 5, Math.floor(y / PX_PER_MIN))));
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const mins = getMinutesFromY(e.clientY);
    setIsDragging(true);
    setDragStart(mins);
    setDragEnd(mins + 30);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStart === null) return;
    const mins = getMinutesFromY(e.clientY);
    setDragEnd(Math.max(dragStart + 5, mins));
  };

  const handleTimelineMouseUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) return;
    setIsDragging(false);
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    setFormStartTime(minutesToTime(start));
    setFormEndTime(minutesToTime(end));
    setEditingEvent(null);
    setFormTitle("");
    setFormType("event");
    setFormNotes("");
    setDragStart(null);
    setDragEnd(null);
    onOpen();
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormType("event");
    setFormNotes("");
    onOpen();
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormStartTime(event.startTime);
    setFormEndTime(event.endTime);
    setFormType(event.type);
    setFormNotes(event.notes || "");
    onOpen();
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    const data = {
      title: formTitle.trim(),
      date: selectedDate,
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

  const handleDelete = async (id: string) => {
    await deleteEvent(id);
  };

  const handleDuplicate = async () => {
    await duplicateSchedule(selectedDate, dupTargetDate);
    onDupOpenChange();
  };

  const getEventStyle = (event: ScheduleEvent) => {
    const startMins = timeToMinutes(event.startTime);
    const endMins = timeToMinutes(event.endTime);
    const top = startMins * PX_PER_MIN;
    const height = Math.max((endMins - startMins) * PX_PER_MIN, 15);
    return { top: `${top}px`, height: `${height}px` };
  };

  const dragPreviewStyle = () => {
    if (dragStart === null || dragEnd === null) return null;
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    return { top: `${start * PX_PER_MIN}px`, height: `${(end - start) * PX_PER_MIN}px` };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 py-4 sm:py-6">
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
            <CardBody className="flex flex-row items-center justify-between p-3">
              <Button isIconOnly size="sm" variant="light" onPress={() => navigateDate(-1)}>
                <ChevronLeft size={16} />
              </Button>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  size="sm"
                  variant="bordered"
                  value={selectedDate}
                  onValueChange={setSelectedDate}
                  classNames={{ inputWrapper: "border-1 h-8" }}
                  className="w-40"
                />
                <span className="text-sm font-medium text-default-600">
                  {format(new Date(selectedDate), "EEEE")}
                </span>
                {selectedDate === format(new Date(), "yyyy-MM-dd") && (
                  <Chip size="sm" color="primary" variant="flat">Today</Chip>
                )}
              </div>
              <Button isIconOnly size="sm" variant="light" onPress={() => navigateDate(1)}>
                <ChevronRight size={16} />
              </Button>
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card shadow="sm">
            <CardHeader className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-sm font-semibold">{events.length} events</span>
              <span className="text-[10px] text-default-400">Drag on timeline to create</span>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <div
                ref={timelineRef}
                className="relative overflow-y-auto max-h-[calc(100vh-280px)] select-none"
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}
                onMouseLeave={() => { if (isDragging) { setIsDragging(false); setDragStart(null); setDragEnd(null); } }}
              >
                {/* Hour grid */}
                <div className="relative" style={{ height: `${24 * 60 * PX_PER_MIN}px` }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-default-100 flex"
                      style={{ top: `${hour * 60 * PX_PER_MIN}px`, height: `${60 * PX_PER_MIN}px` }}
                    >
                      <span className="text-[10px] text-default-400 w-14 px-2 py-0.5 shrink-0">
                        {formatTimeStr(`${String(hour).padStart(2, "0")}:00`, timeFmt)}
                      </span>
                    </div>
                  ))}

                  {/* 5-min grid lines (lighter) */}
                  {HOURS.map((hour) =>
                    [15, 30, 45].map((min) => (
                      <div
                        key={`${hour}-${min}`}
                        className="absolute left-12 right-0 border-t border-default-50"
                        style={{ top: `${(hour * 60 + min) * PX_PER_MIN}px` }}
                      />
                    ))
                  )}

                  {/* Current time marker (only when viewing today) */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none"
                      style={{ top: `${nowMinutes * PX_PER_MIN}px` }}
                    >
                      <div className="flex items-center">
                        <span className="text-[10px] text-danger font-semibold w-14 px-1 bg-background tabular-nums">
                          {formatTimeStr(minutesToTime(nowMinutes), timeFmt)}
                        </span>
                        <div className="flex-1 h-0.5 bg-danger" />
                        <div className="absolute left-14 -translate-x-1/2 -translate-y-1/2 top-0 w-2 h-2 rounded-full bg-danger ring-2 ring-background" />
                      </div>
                    </div>
                  )}

                  {/* Drag preview */}
                  {isDragging && dragPreviewStyle() && (
                    <div
                      className="absolute left-14 right-2 bg-primary/20 border-2 border-primary/50 rounded-md pointer-events-none z-10"
                      style={dragPreviewStyle()!}
                    >
                      <span className="text-[10px] text-primary font-medium px-2">
                        {formatTimeStr(minutesToTime(Math.min(dragStart!, dragEnd!)), timeFmt)} - {formatTimeStr(minutesToTime(Math.max(dragStart!, dragEnd!)), timeFmt)}
                      </span>
                    </div>
                  )}

                  {/* Events overlay */}
                  <div className="absolute left-14 right-2 top-0 bottom-0">
                    {events.map((event) => {
                      const style = getEventStyle(event);
                      return (
                        <div
                          key={event.id}
                          data-event
                          className={`absolute left-0 right-0 rounded-md px-2 py-0.5 cursor-pointer border border-white/20 overflow-hidden group ${getEventColor(event.type)} text-white z-20`}
                          style={style}
                          onClick={(e) => { e.stopPropagation(); openEdit(event); }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate">{event.title}</span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 min-w-5 text-white"
                              onPress={() => handleDelete(event.id)}
                            >
                              <Trash2 size={10} />
                            </Button>
                          </div>
                          <span className="text-[10px] opacity-80">{formatTimeStr(event.startTime, timeFmt)} - {formatTimeStr(event.endTime, timeFmt)}</span>
                        </div>
                      );
                    })}
                  </div>
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
      </main>
    </div>
  );
}
