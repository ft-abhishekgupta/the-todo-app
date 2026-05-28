import type { Task, TaskCategory } from "@/types";

export const categoryGroups: {
  key: TaskCategory;
  label: string;
  color: string;
  subtypes: { key: string; label: string }[];
}[] = [
  {
    key: "work",
    label: "Work",
    color: "text-primary",
    subtypes: [
      { key: "project_task", label: "Project" },
      { key: "general_task", label: "General" },
      { key: "chores", label: "Chores" },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    color: "text-success",
    subtypes: [
      { key: "general_task", label: "General" },
      { key: "project_task", label: "Project" },
      { key: "chores", label: "Chores" },
      { key: "social", label: "Social" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    color: "text-warning",
    subtypes: [
      { key: "professional_learning", label: "Professional Learning" },
      { key: "personal_learning", label: "Personal Learning" },
      { key: "improvement", label: "Improvement" },
    ],
  },
  {
    key: "habit",
    label: "Habit",
    color: "text-secondary",
    subtypes: [],
  },
];

export type SubSection = {
  key: string;
  label: string;
  tasks: Task[];
  projectSections: { projectId: string; name: string; tasks: Task[] }[] | null;
};

export type CategorySection = {
  category: TaskCategory;
  label: string;
  color: string;
  count: number;
  subSections: SubSection[];
};

export type GroupedColumn = { flatOrder: Task[]; sections: CategorySection[] };

export function groupColumnTasks(
  colTasks: Task[],
  projectsMap: Record<string, string>
): GroupedColumn {
  const sections: CategorySection[] = [];
  const flatOrder: Task[] = [];

  for (const cat of categoryGroups) {
    const catTasks = colTasks.filter((t) => t.category === cat.key);
    if (catTasks.length === 0) continue;

    const subSections: SubSection[] = [];
    const seenIds = new Set<string>();

    const subtypeKeys = cat.subtypes.map((s) => s.key);
    for (const sub of cat.subtypes) {
      const subTasks = catTasks.filter((t) => (t.subtype || "") === sub.key);
      if (subTasks.length === 0) continue;
      subTasks.forEach((t) => seenIds.add(t.id));

      if (sub.key === "project_task") {
        const projectMap = new Map<string, Task[]>();
        const noProject: Task[] = [];
        for (const t of subTasks) {
          if (t.projectId) {
            const arr = projectMap.get(t.projectId) || [];
            arr.push(t);
            projectMap.set(t.projectId, arr);
          } else {
            noProject.push(t);
          }
        }
        const projectSections: { projectId: string; name: string; tasks: Task[] }[] = [];
        Array.from(projectMap.entries())
          .sort((a, b) => (projectsMap[a[0]] || "").localeCompare(projectsMap[b[0]] || ""))
          .forEach(([pid, ts]) => {
            projectSections.push({ projectId: pid, name: projectsMap[pid] || "Unknown project", tasks: ts });
            ts.forEach((t) => flatOrder.push(t));
          });
        if (noProject.length > 0) {
          projectSections.push({ projectId: "__none__", name: "No project", tasks: noProject });
          noProject.forEach((t) => flatOrder.push(t));
        }
        subSections.push({ key: sub.key, label: sub.label, tasks: [], projectSections });
      } else {
        subTasks.forEach((t) => flatOrder.push(t));
        subSections.push({ key: sub.key, label: sub.label, tasks: subTasks, projectSections: null });
      }
    }

    const otherTasks = catTasks.filter((t) => !seenIds.has(t.id) && !subtypeKeys.includes(t.subtype || ""));
    if (otherTasks.length > 0) {
      otherTasks.forEach((t) => flatOrder.push(t));
      subSections.push({ key: "__other__", label: "Other", tasks: otherTasks, projectSections: null });
    }

    sections.push({
      category: cat.key,
      label: cat.label,
      color: cat.color,
      count: catTasks.length,
      subSections,
    });
  }

  const known = new Set(categoryGroups.map((c) => c.key));
  const uncategorized = colTasks.filter((t) => !known.has(t.category));
  if (uncategorized.length > 0) {
    uncategorized.forEach((t) => flatOrder.push(t));
    sections.push({
      category: "work",
      label: "Uncategorized",
      color: "text-default-500",
      count: uncategorized.length,
      subSections: [{ key: "__other__", label: "Other", tasks: uncategorized, projectSections: null }],
    });
  }

  return { flatOrder, sections };
}
