"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
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

const EVENT_TYPES = [
  { key: "meeting", label: "Meeting", color: "bg-blue-500" },
  { key: "task", label: "Task", color: "bg-green-500" },
  { key: "habit", label: "Habit", color: "bg-purple-500" },
  { key: "block", label: "Focus Block", color: "bg-orange-500" },
  { key: "break", label: "Break", color: "bg-gray-400" },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getEventColor(type: string) {
  return EVENT_TYPES.find((t) => t.key === type)?.color || "bg-gray-400";
}

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { events, loading: eventsLoading } = useSchedule(selectedDate);
  const { addEvent, updateEvent, deleteEvent, duplicateSchedule } = useScheduleMutations();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isDupOpen, onOpen: onDupOpen, onOpenChange: onDupOpenChange } = useDisclosure();

  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formType, setFormType] = useState<ScheduleEvent["type"]>("meeting");
  const [formNotes, setFormNotes] = useState("");
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [dupTargetDate, setDupTargetDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));

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

  const openCreate = (hour?: number) => {
    setEditingEvent(null);
    setFormTitle("");
    setFormStartTime(hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "09:00");
    setFormEndTime(hour !== undefined ? `${String(hour + 1).padStart(2, "0")}:00` : "10:00");
    setFormType("meeting");
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

  // Calculate position for events in the timeline
  const getEventStyle = (event: ScheduleEvent) => {
    const [startH, startM] = event.startTime.split(":").map(Number);
    const [endH, endM] = event.endTime.split(":").map(Number);
    const top = (startH + startM / 60) * 60; // 60px per hour
    const height = Math.max(((endH + endM / 60) - (startH + startM / 60)) * 60, 20);
    return { top: `${top}px`, height: `${height}px` };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-6">
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
              <Button size="sm" color="primary" onPress={() => openCreate()} startContent={<Plus size={14} />}>
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
            <CardHeader className="px-4 py-2.5">
              <span className="text-sm font-semibold">{events.length} events</span>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <div className="relative overflow-y-auto max-h-[calc(100vh-280px)]">
                {/* Hour grid */}
                <div className="relative" style={{ height: `${24 * 60}px` }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-default-100 flex cursor-pointer hover:bg-content2/30 transition-colors"
                      style={{ top: `${hour * 60}px`, height: "60px" }}
                      onClick={() => openCreate(hour)}
                    >
                      <span className="text-[10px] text-default-400 w-12 px-2 py-1 shrink-0">
                        {`${String(hour).padStart(2, "0")}:00`}
                      </span>
                    </div>
                  ))}

                  {/* Events overlay */}
                  <div className="absolute left-12 right-2 top-0 bottom-0">
                    {events.map((event) => {
                      const style = getEventStyle(event);
                      return (
                        <div
                          key={event.id}
                          className={`absolute left-0 right-0 rounded-md px-2 py-1 cursor-pointer border border-white/20 overflow-hidden group ${getEventColor(event.type)} text-white`}
                          style={style}
                          onClick={() => openEdit(event)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate">{event.title}</span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 min-w-5 text-white"
                              onPress={(e) => { handleDelete(event.id); }}
                            >
                              <Trash2 size={10} />
                            </Button>
                          </div>
                          <span className="text-[10px] opacity-80">{event.startTime} - {event.endTime}</span>
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
