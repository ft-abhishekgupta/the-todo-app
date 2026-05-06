"use client";

import { useState } from "react";
import { Input, Button, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@nextui-org/react";
import { ListPlus, Plus } from "lucide-react";
import { useLists, useListMutations } from "@/hooks/use-lists";
import toast from "react-hot-toast";

export function QuickAddToList() {
  const { lists } = useLists();
  const { addItem } = useListMutations();
  const [selectedListId, setSelectedListId] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [open, setOpen] = useState(false);

  const handleAdd = async () => {
    const list = lists.find((l) => l.id === selectedListId);
    if (!list || !itemTitle.trim()) return;
    await addItem(list.id, list, { title: itemTitle.trim(), completed: false });
    toast.success(`Added to ${list.name}`);
    setItemTitle("");
    setOpen(false);
  };

  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom-end">
      <PopoverTrigger>
        <Button size="sm" variant="flat" startContent={<ListPlus size={14} />} title="Add to a list">
          Add to list
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-72">
        <div className="w-full space-y-2">
          <p className="text-xs font-semibold">Add an item to a list</p>
          {lists.length === 0 ? (
            <p className="text-xs text-default-400">
              No lists yet — create one on the Lists page.
            </p>
          ) : (
            <>
              <Select
                size="sm"
                variant="bordered"
                aria-label="List"
                placeholder="Choose a list..."
                selectedKeys={selectedListId ? [selectedListId] : []}
                onSelectionChange={(k) => setSelectedListId(Array.from(k)[0] as string)}
              >
                {lists.map((l) => (
                  <SelectItem key={l.id} description={l.category}>
                    {l.name}
                  </SelectItem>
                ))}
              </Select>
              <Input
                size="sm"
                variant="bordered"
                placeholder="Item to add..."
                value={itemTitle}
                onValueChange={setItemTitle}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                startContent={<Plus size={12} className="text-default-400" />}
                autoFocus
              />
              <Button
                size="sm"
                color="primary"
                fullWidth
                isDisabled={!selectedListId || !itemTitle.trim()}
                onPress={handleAdd}
              >
                Add
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
