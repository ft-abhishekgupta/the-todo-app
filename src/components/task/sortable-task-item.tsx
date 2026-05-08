"use client";

import { useState } from "react";
import { Input, Button, Progress } from "@nextui-org/react";
import { GripVertical, Plus, Star } from "lucide-react";
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
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Task, TaskPriority, Subtask } from "@/types";

export function SortableSubtask({
  subtask,
  onToggle,
  onUpdateTitle,
}: {
  subtask: Subtask;
  onToggle: () => void;
  onUpdateTitle: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: subtask.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== subtask.title) {
      onUpdateTitle(editValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 pl-8 py-0.5 group/sub">
      <button {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover/sub:opacity-100 touch-none shrink-0">
        <GripVertical size={10} className="text-default-300" />
      </button>
      <div
        className={`w-3 h-3 rounded-sm border flex items-center justify-center cursor-pointer shrink-0 ${
          subtask.completed ? "bg-success/70 border-success" : "border-default-300 hover:border-primary"
        }`}
        onClick={onToggle}
      >
        {subtask.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {isEditing ? (
        <input
          className="text-xs bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          autoFocus
        />
      ) : (
        <span
          className={`text-xs truncate cursor-text ${subtask.completed ? "line-through text-default-400" : "text-default-600"}`}
          onClick={() => { setIsEditing(true); setEditValue(subtask.title); }}
        >
          {subtask.title}
        </span>
      )}
    </div>
  );
}

export function SortableTaskItem({
  task,
  onToggle,
  onSetFocus,
  onAddSubtask,
  onToggleSubtask,
  onReorderSubtasks,
  onUpdateTitle,
  onTogglePriority,
  onOpenEditModal,
  onUpdateSubtaskTitle,
  isFocused = false,
  projectName,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onSetFocus?: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onUpdateTitle: (taskId: string, title: string) => void;
  onTogglePriority: (taskId: string, currentPriority: TaskPriority) => void;
  onOpenEditModal: (task: Task) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
  isFocused?: boolean;
  projectName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = subtasks.findIndex((s) => s.id === active.id);
    const newIdx = subtasks.findIndex((s) => s.id === over.id);
    onReorderSubtasks(task.id, arrayMove(subtasks, oldIdx, newIdx));
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    setAddingSubtask(false);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(task.title);
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdateTitle(task.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const priorityDotColors: Record<TaskPriority, string> = {
    low: "bg-orange-400",
    medium: "bg-blue-500",
    high: "bg-red-500",
  };

  return (
    <div onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onOpenEditModal(task); }}>
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg hover:bg-content2/50 transition-colors mb-1 cursor-grab active:cursor-grabbing touch-none ${isFocused ? "bg-primary/5 border border-primary/20" : ""}`}
    >
      <div className="flex items-center gap-2 p-2 group">
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer shrink-0 ${
            task.status === "completed"
              ? "bg-success border-success"
              : task.status === "blocked"
              ? "bg-warning/30 border-warning"
              : "border-default-300 hover:border-primary"
          }`}
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.status !== "completed"); }}
        >
          {task.status === "completed" && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === "blocked" && (
            <div className="w-2 h-0.5 bg-warning rounded" />
          )}
        </div>
        <div className="flex-1 min-w-0" onClick={handleTitleClick}>
          {isEditingTitle ? (
            <Input
              size="sm"
              variant="bordered"
              value={editTitle}
              onValueChange={setEditTitle}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              classNames={{ inputWrapper: "border-1 h-6 min-h-6", input: "text-xs" }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`text-sm truncate cursor-text ${task.status === "completed" ? "line-through text-default-400" : ""}`}>
                {task.title}
              </span>
              {projectName && <span className="text-[9px] text-default-400 shrink-0">· {projectName}</span>}
            </div>
          )}
          {subtasks.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Progress size="sm" value={(completedSubtasks / subtasks.length) * 100} color="primary" className="w-16" />
              <span className="text-[10px] text-default-400">{completedSubtasks}/{subtasks.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="opacity-0 group-hover:opacity-100 w-5 h-5 min-w-5"
            onPress={() => setAddingSubtask(!addingSubtask)}
            title="Add subtask"
          >
            <Plus size={10} />
          </Button>
          {onSetFocus && task.status !== "completed" && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className={`w-5 h-5 min-w-5 transition-opacity ${isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onPress={() => onSetFocus(task.id)}
              title={isFocused ? "Remove from focus" : "Set as focus"}
            >
              <Star size={10} className={isFocused ? "text-primary fill-primary" : ""} />
            </Button>
          )}
          <div
            className={`w-2.5 h-2.5 rounded-full cursor-pointer ${priorityDotColors[task.priority]}`}
            onClick={(e) => { e.stopPropagation(); onTogglePriority(task.id, task.priority); }}
            title={`Priority: ${task.priority} (click to change)`}
          />
        </div>
      </div>

      {subtasks.length > 0 && (
        <DndContext sensors={subtaskSensors} collisionDetection={closestCenter} onDragEnd={handleSubtaskDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {subtasks.map((st) => (
              <SortableSubtask
                key={st.id}
                subtask={st}
                onToggle={() => onToggleSubtask(task.id, st.id)}
                onUpdateTitle={(title) => onUpdateSubtaskTitle(task.id, st.id, title)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {addingSubtask && (
        <div className="flex items-center gap-1.5 pl-8 pr-2 pb-2">
          <Input
            size="sm"
            variant="bordered"
            placeholder="Subtask..."
            value={newSubtaskTitle}
            onValueChange={setNewSubtaskTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
              if (e.key === "Escape") setAddingSubtask(false);
            }}
            classNames={{ inputWrapper: "border-1 h-6", input: "text-xs" }}
            autoFocus
          />
          <Button size="sm" isIconOnly variant="flat" color="primary" className="w-6 h-6 min-w-6" onPress={handleAddSubtask}>
            <Plus size={10} />
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}
