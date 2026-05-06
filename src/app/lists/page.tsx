"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Chip,
  Select,
  SelectItem,
  Checkbox,
  Progress,
  Tooltip,
} from "@nextui-org/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  ListChecks,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  Search,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { useLists, useListMutations } from "@/hooks/use-lists";
import { UserList, ListItem } from "@/types";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const listColors = [
  "#0072F5", "#17c964", "#f5a524", "#f31260",
  "#7828c8", "#06b7db", "#ff6b6b", "#4ecdc4",
];

function SortableListCard({
  list,
  onOpen,
  onEdit,
  onDelete,
  onToggleItem,
}: {
  list: UserList;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleItem: (itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const completed = list.items.filter((i) => i.completed).length;
  const progress = list.items.length === 0 ? 0 : Math.round((completed / list.items.length) * 100);
  const previewItems = list.items.slice(0, 4);

  return (
    <div ref={setNodeRef} style={style}>
      <Card shadow="sm" className="h-full hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: list.color }}>
        <CardHeader className="flex justify-between items-start gap-2 pb-1 px-3 pt-2">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none mt-0.5 shrink-0" title="Drag to reorder">
              <GripVertical size={14} className="text-default-300 hover:text-default-500" />
            </button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{list.name}</h3>
                <Chip size="sm" variant="flat" className="h-4 text-[9px]">{list.category}</Chip>
              </div>
              {list.description && (
                <p className="text-default-500 text-[11px] truncate mt-0.5">{list.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={onEdit} title="Edit">
              <Edit3 size={11} />
            </Button>
            <Button isIconOnly size="sm" variant="light" color="danger" className="w-6 h-6 min-w-6" onPress={onDelete} title="Delete">
              <Trash2 size={11} />
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-1 px-3 pb-3 space-y-2">
          {list.items.length > 0 && (
            <div className="flex items-center gap-2">
              <Progress size="sm" value={progress} color="primary" className="flex-1" />
              <span className="text-[10px] text-default-400 tabular-nums shrink-0">
                {completed}/{list.items.length}
              </span>
            </div>
          )}
          <div className="space-y-0.5 cursor-pointer" onClick={onOpen}>
            {previewItems.length === 0 ? (
              <p className="text-[11px] text-default-400 italic py-2 text-center">Empty list — click to add items</p>
            ) : (
              previewItems.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="sm"
                    isSelected={item.completed}
                    onValueChange={() => onToggleItem(item.id)}
                    classNames={{ wrapper: "after:bg-primary" }}
                  />
                  <span className={`text-xs truncate flex-1 ${item.completed ? "line-through text-default-400" : ""}`}>
                    {item.title}
                  </span>
                </div>
              ))
            )}
            {list.items.length > 4 && (
              <p className="text-[10px] text-default-400 pl-6">+{list.items.length - 4} more</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function ListsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { lists, loading: listsLoading } = useLists();
  const { addList, updateList, deleteList, reorderLists, addItem, updateItem, deleteItem } = useListMutations();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onOpenChange: onCreateOpenChange } = useDisclosure();
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onOpenChange: onDetailOpenChange } = useDisclosure();

  const [editingList, setEditingList] = useState<UserList | null>(null);
  const [detailListId, setDetailListId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState(listColors[0]);

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Build dynamic category list from existing lists
  const categories = useMemo(() => {
    const set = new Set<string>();
    lists.forEach((l) => set.add(l.category));
    return Array.from(set).sort();
  }, [lists]);

  const filteredLists = useMemo(() => {
    let result = lists;
    if (filterCategory !== "all") result = result.filter((l) => l.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.items.some((i) => i.title.toLowerCase().includes(q))
      );
    }
    return result;
  }, [lists, filterCategory, searchQuery]);

  const detailList = lists.find((l) => l.id === detailListId);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const resetForm = () => {
    setFormName("");
    setFormCategory("");
    setFormDescription("");
    setFormColor(listColors[Math.floor(Math.random() * listColors.length)]);
    setEditingList(null);
  };

  const openCreate = () => {
    resetForm();
    onCreateOpen();
  };

  const openEdit = (list: UserList) => {
    setEditingList(list);
    setFormName(list.name);
    setFormCategory(list.category);
    setFormDescription(list.description || "");
    setFormColor(list.color);
    onCreateOpen();
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCategory.trim()) return;
    if (editingList) {
      await updateList(editingList.id, {
        name: formName.trim(),
        category: formCategory.trim(),
        description: formDescription.trim() || undefined,
        color: formColor,
      });
    } else {
      await addList({
        name: formName.trim(),
        category: formCategory.trim(),
        description: formDescription.trim() || undefined,
        color: formColor,
      });
    }
    onCreateOpenChange();
    resetForm();
  };

  const handleDeleteList = async (list: UserList) => {
    if (confirm(`Delete list "${list.name}"? This cannot be undone.`)) {
      await deleteList(list.id);
      if (detailListId === list.id) {
        setDetailListId(null);
        onDetailOpenChange();
      }
    }
  };

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredLists.findIndex((l) => l.id === active.id);
    const newIdx = filteredLists.findIndex((l) => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    // Reorder within the full lists array, preserving filter
    const reordered = arrayMove(filteredLists, oldIdx, newIdx);
    // Build new full order: filteredLists in their new order, plus the unfiltered ones
    // To keep it simple, just use the new order of filteredLists when filter is "all";
    // when filtering, we still reorder the full list using the same relative move
    if (filterCategory === "all" && !searchQuery) {
      reorderLists(reordered.map((l) => l.id));
    } else {
      // map filtered move back to full ordering
      const fullOldIdx = lists.findIndex((l) => l.id === active.id);
      const fullNewIdx = lists.findIndex((l) => l.id === over.id);
      const fullReordered = arrayMove(lists, fullOldIdx, fullNewIdx);
      reorderLists(fullReordered.map((l) => l.id));
    }
  };

  const handleToggleItem = async (list: UserList, itemId: string) => {
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;
    await updateItem(list.id, list, itemId, { completed: !item.completed });
  };

  const handleAddItem = async () => {
    if (!detailList || !newItemTitle.trim()) return;
    await addItem(detailList.id, detailList, {
      title: newItemTitle.trim(),
      completed: false,
      url: newItemUrl.trim() || undefined,
    });
    setNewItemTitle("");
    setNewItemUrl("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-full px-3 sm:px-4 lg:px-[7%] py-4 sm:py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2">
              <h1 className="text-lg font-bold leading-none">Lists</h1>
              <p className="text-default-500 text-[10px]">{lists.length} lists · {categories.length} categories</p>
            </div>
            <Input
              size="sm"
              variant="bordered"
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Search size={12} className="text-default-400" />}
              className="w-40"
            />
            <Select
              size="sm"
              variant="bordered"
              className="w-40"
              aria-label="Category filter"
              placeholder="Category"
              selectedKeys={[filterCategory]}
              onSelectionChange={(k) => setFilterCategory(Array.from(k)[0] as string)}
            >
              {[{ key: "all", label: "All Categories" }, ...categories.map((c) => ({ key: c, label: c }))].map((c) => (
                <SelectItem key={c.key}>{c.label}</SelectItem>
              ))}
            </Select>
            {(filterCategory !== "all" || searchQuery) && (
              <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => { setFilterCategory("all"); setSearchQuery(""); }}>
                <X size={12} />
              </Button>
            )}
            <span className="text-[10px] text-default-400">{filteredLists.length}</span>
            <div className="flex-1" />
            <Button color="primary" size="sm" startContent={<Plus size={14} />} onPress={openCreate} className="shrink-0">
              New List
            </Button>
          </div>

          {/* Empty state */}
          {filteredLists.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <ListChecks size={40} className="mx-auto text-default-300 mb-3" />
                <p className="text-default-400 text-sm">
                  {lists.length === 0 ? "No lists yet — create your first bucket list" : "No lists match the filters"}
                </p>
                {lists.length === 0 && (
                  <Button color="primary" variant="flat" size="sm" className="mt-3" onPress={openCreate}>
                    Create a List
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
              <SortableContext items={filteredLists.map((l) => l.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredLists.map((list) => (
                    <SortableListCard
                      key={list.id}
                      list={list}
                      onOpen={() => { setDetailListId(list.id); onDetailOpen(); }}
                      onEdit={() => openEdit(list)}
                      onDelete={() => handleDeleteList(list)}
                      onToggleItem={(itemId) => handleToggleItem(list, itemId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </motion.div>
      </main>

      {/* Create / Edit list modal */}
      <Modal isOpen={isCreateOpen} onOpenChange={onCreateOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{editingList ? "Edit List" : "New List"}</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Name"
                  placeholder="e.g. Movies to Watch"
                  value={formName}
                  onValueChange={setFormName}
                  variant="bordered"
                  size="sm"
                  isRequired
                />
                <Input
                  label="Category"
                  placeholder="e.g. Media, Travel, Books"
                  value={formCategory}
                  onValueChange={setFormCategory}
                  variant="bordered"
                  size="sm"
                  isRequired
                  description={categories.length > 0 ? `Existing: ${categories.join(", ")}` : "Categories are created on the fly"}
                />
                <Textarea
                  label="Description"
                  placeholder="What's this list about?"
                  value={formDescription}
                  onValueChange={setFormDescription}
                  variant="bordered"
                  size="sm"
                  minRows={2}
                />
                <div>
                  <p className="text-xs font-medium mb-1.5">Color</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {listColors.map((c) => (
                      <button
                        key={c}
                        className={`w-6 h-6 rounded-full transition-transform ${formColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setFormColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" size="sm" onPress={onClose}>Cancel</Button>
                <Button color="primary" size="sm" onPress={handleSave} isDisabled={!formName.trim() || !formCategory.trim()}>
                  {editingList ? "Update" : "Create"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* List detail modal */}
      <Modal isOpen={isDetailOpen} onOpenChange={onDetailOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => {
            if (!detailList) return null;
            const completed = detailList.items.filter((i) => i.completed).length;
            const progress = detailList.items.length === 0 ? 0 : Math.round((completed / detailList.items.length) * 100);
            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: detailList.color }} />
                    <span>{detailList.name}</span>
                    <Chip size="sm" variant="flat">{detailList.category}</Chip>
                  </div>
                  {detailList.description && (
                    <p className="text-xs font-normal text-default-500">{detailList.description}</p>
                  )}
                </ModalHeader>
                <ModalBody className="space-y-3">
                  {detailList.items.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Progress size="sm" value={progress} color="primary" className="flex-1" />
                      <span className="text-xs text-default-500 tabular-nums">{completed}/{detailList.items.length}</span>
                    </div>
                  )}

                  {/* Add item */}
                  <div className="flex gap-2">
                    <Input
                      size="sm"
                      placeholder="Add item..."
                      value={newItemTitle}
                      onValueChange={setNewItemTitle}
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                      variant="bordered"
                      startContent={<Plus size={12} className="text-default-400" />}
                      className="flex-1"
                    />
                    <Input
                      size="sm"
                      placeholder="URL (optional)"
                      value={newItemUrl}
                      onValueChange={setNewItemUrl}
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                      variant="bordered"
                      className="w-44"
                    />
                    <Button size="sm" color="primary" onPress={handleAddItem} isDisabled={!newItemTitle.trim()}>
                      Add
                    </Button>
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {detailList.items.length === 0 ? (
                      <p className="text-sm text-default-400 text-center py-6 italic">
                        No items yet. Use the input above to add one.
                      </p>
                    ) : (
                      detailList.items.map((item) => (
                        <ListItemRow
                          key={item.id}
                          item={item}
                          onToggle={() => handleToggleItem(detailList, item.id)}
                          onUpdate={(updates) => updateItem(detailList.id, detailList, item.id, updates)}
                          onDelete={() => deleteItem(detailList.id, detailList, item.id)}
                        />
                      ))
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" size="sm" onPress={() => { openEdit(detailList); }}>
                    <Edit3 size={12} /> Edit list
                  </Button>
                  <Button color="primary" size="sm" onPress={onClose}>Close</Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}

function ListItemRow({
  item,
  onToggle,
  onUpdate,
  onDelete,
}: {
  item: ListItem;
  onToggle: () => void;
  onUpdate: (updates: Partial<ListItem>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const [notesValue, setNotesValue] = useState(item.notes || "");
  const [urlValue, setUrlValue] = useState(item.url || "");

  const saveTitle = () => {
    const t = editValue.trim();
    if (t && t !== item.title) onUpdate({ title: t });
    setIsEditing(false);
  };

  const saveDetails = () => {
    onUpdate({
      notes: notesValue.trim() || undefined,
      url: urlValue.trim() || undefined,
    });
  };

  return (
    <div className="rounded-lg bg-content2 hover:bg-content3 group">
      <div className="flex items-center gap-2 p-2">
        <Checkbox size="sm" isSelected={item.completed} onValueChange={onToggle} />
        {isEditing ? (
          <input
            className="text-sm bg-transparent border-b border-primary outline-none flex-1 min-w-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") { setEditValue(item.title); setIsEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <span
            className={`text-sm truncate flex-1 cursor-text ${item.completed ? "line-through text-default-400" : ""}`}
            onClick={() => { setEditValue(item.title); setIsEditing(true); }}
          >
            {item.title}
          </span>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6">
              <ExternalLink size={11} />
            </Button>
          </a>
        )}
        <Button isIconOnly size="sm" variant="light" className="w-6 h-6 min-w-6" onPress={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </Button>
        <Button isIconOnly size="sm" variant="light" color="danger" className="w-6 h-6 min-w-6 opacity-0 group-hover:opacity-100" onPress={onDelete}>
          <Trash2 size={11} />
        </Button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-2">
              <Input
                size="sm"
                label="URL"
                value={urlValue}
                onValueChange={setUrlValue}
                onBlur={saveDetails}
                variant="bordered"
                placeholder="https://..."
              />
              <Textarea
                size="sm"
                label="Notes"
                value={notesValue}
                onValueChange={setNotesValue}
                onBlur={saveDetails}
                variant="bordered"
                minRows={2}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
