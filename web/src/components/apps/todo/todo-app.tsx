"use client"

import { useState, useMemo, useRef } from "react"
import {
  Plus,
  Star,
  Search,
  CheckSquare,
  CalendarDays,
  ListTodo,
  LayoutList,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  INITIAL_TASKS,
  TASK_LISTS,
  LIST_COLORS,
  type Task,
  type TaskList,
} from "./data"

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewId = "all" | "today" | "important" | "completed"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = "2026-06-07"

function formatDue(dateStr: string | null): string | null {
  if (!dateStr) return null
  if (dateStr === TODAY) return "Today"
  // compute tomorrow from TODAY without new Date()
  const [y, m, d] = TODAY.split("-").map(Number)
  const tomorrowDay = d + 1
  // simple: build tomorrow string with padding
  const padded = (n: number) => String(n).padStart(2, "0")
  // handle month overflow minimally (sufficient for seeded data)
  const tomorrowStr = `${y}-${padded(m)}-${padded(tomorrowDay)}`
  if (dateStr === tomorrowStr) return "Tomorrow"
  const [, dm, dd] = dateStr.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[dm - 1]} ${dd}`
}

const PRIORITY_CLASSES: Record<Task["priority"], string> = {
  High: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
}

let taskCounter = 200

function makeTaskId(): string {
  taskCounter++
  return `task-${taskCounter}`
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  tasks: Task[]
  view: ViewId
  listFilter: TaskList | null
  onViewChange: (v: ViewId) => void
  onListChange: (l: TaskList | null) => void
  onAddTask: () => void
}

function TodoSidebar({
  tasks,
  view,
  listFilter,
  onViewChange,
  onListChange,
  onAddTask,
}: SidebarProps) {
  const counts = useMemo(() => {
    const all = tasks.length
    const today = tasks.filter((t) => t.dueDate === TODAY).length
    const important = tasks.filter((t) => t.starred).length
    const completed = tasks.filter((t) => t.completed).length
    const byList: Record<TaskList, number> = {
      Personal: 0,
      Work: 0,
      Shopping: 0,
      Health: 0,
    }
    for (const t of tasks) {
      byList[t.list]++
    }
    return { all, today, important, completed, byList }
  }, [tasks])

  const views: { id: ViewId; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "all", label: "All Tasks", icon: <LayoutList className="size-4" />, count: counts.all },
    { id: "today", label: "Today", icon: <CalendarDays className="size-4" />, count: counts.today },
    { id: "important", label: "Important", icon: <Star className="size-4" />, count: counts.important },
    { id: "completed", label: "Completed", icon: <CheckSquare className="size-4" />, count: counts.completed },
  ]

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-border p-4">
      <Button
        onClick={onAddTask}
        className="w-full justify-start gap-2"
      >
        <Plus className="size-4" />
        Add Task
      </Button>

      <div className="space-y-1">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Views
        </p>
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              onListChange(null)
              onViewChange(v.id)
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
              view === v.id && listFilter === null
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground hover:bg-muted"
            )}
          >
            {v.icon}
            <span className="flex-1 text-left">{v.label}</span>
            <span className="text-xs text-muted-foreground">{v.count}</span>
          </button>
        ))}
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lists
        </p>
        {TASK_LISTS.map((list) => (
          <button
            key={list}
            onClick={() => {
              onViewChange("all")
              onListChange(list)
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
              listFilter === list
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span
              className={cn("size-2 shrink-0 rounded-full", LIST_COLORS[list])}
            />
            <span className="flex-1 text-left">{list}</span>
            <span className="text-xs text-muted-foreground">
              {counts.byList[list]}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  onToggleComplete: (id: string) => void
  onToggleStar: (id: string) => void
}

function TaskRow({ task, onToggleComplete, onToggleStar }: TaskRowProps) {
  const due = formatDue(task.dueDate)

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
        task.completed && "opacity-60"
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggleComplete(task.id)}
        className="shrink-0"
      />

      <span
        className={cn(
          "flex-1 truncate text-sm",
          task.completed && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          className={cn(
            "border-transparent text-xs",
            PRIORITY_CLASSES[task.priority]
          )}
        >
          {task.priority}
        </Badge>

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            LIST_COLORS[task.list]
              .replace("bg-", "bg-")
              .replace("500", "100"),
            "text-foreground/70"
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", LIST_COLORS[task.list])}
          />
          {task.list}
        </span>

        {due && (
          <span className="text-xs text-muted-foreground">{due}</span>
        )}

        <button
          onClick={() => onToggleStar(task.id)}
          className={cn(
            "rounded p-0.5 transition-colors",
            task.starred
              ? "text-amber-400 hover:text-amber-500"
              : "text-muted-foreground/40 hover:text-amber-400"
          )}
          aria-label={task.starred ? "Unstar task" : "Star task"}
        >
          <Star
            className={cn("size-4", task.starred && "fill-amber-400")}
          />
        </button>
      </div>
    </div>
  )
}

// ─── Add Task Row ─────────────────────────────────────────────────────────────

interface AddTaskRowProps {
  onAdd: (title: string) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

function AddTaskRow({ onAdd, inputRef }: AddTaskRowProps) {
  const [value, setValue] = useState("")

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      onAdd(value.trim())
      setValue("")
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
      <Plus className="size-4 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task… (press Enter)"
        className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [view, setView] = useState<ViewId>("all")
  const [listFilter, setListFilter] = useState<TaskList | null>(null)
  const [search, setSearch] = useState("")
  const addInputRef = useRef<HTMLInputElement | null>(null)

  function toggleComplete(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  function toggleStar(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t))
    )
  }

  function addTask(title: string) {
    const newTask: Task = {
      id: makeTaskId(),
      title,
      completed: false,
      starred: false,
      priority: "Medium",
      list: listFilter ?? "Personal",
      dueDate: null,
    }
    setTasks((prev) => [newTask, ...prev])
  }

  function handleAddTaskClick() {
    addInputRef.current?.focus()
  }

  const visibleTasks = useMemo(() => {
    let result = tasks

    if (listFilter !== null) {
      result = result.filter((t) => t.list === listFilter)
    } else {
      switch (view) {
        case "today":
          result = result.filter((t) => t.dueDate === TODAY)
          break
        case "important":
          result = result.filter((t) => t.starred)
          break
        case "completed":
          result = result.filter((t) => t.completed)
          break
        // "all" — no filter
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }

    return result
  }, [tasks, view, listFilter, search])

  const headerTitle = useMemo(() => {
    if (listFilter !== null) return listFilter
    const labels: Record<ViewId, string> = {
      all: "All Tasks",
      today: "Today",
      important: "Important",
      completed: "Completed",
    }
    return labels[view]
  }, [view, listFilter])

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <TodoSidebar
        tasks={tasks}
        view={view}
        listFilter={listFilter}
        onViewChange={(v) => {
          setView(v)
          setListFilter(null)
        }}
        onListChange={(l) => {
          setListFilter(l)
          if (l !== null) setView("all")
        }}
        onAddTask={handleAddTaskClick}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <ListTodo className="size-5 shrink-0 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{headerTitle}</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Task list */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-3 space-y-1">
            <AddTaskRow onAdd={addTask} inputRef={addInputRef} />

            {visibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <CheckSquare className="size-10 opacity-30" />
                <p className="text-sm">No tasks here</p>
              </div>
            ) : (
              visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggleComplete={toggleComplete}
                  onToggleStar={toggleStar}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
