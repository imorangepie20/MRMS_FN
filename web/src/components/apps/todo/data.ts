export type Priority = "High" | "Medium" | "Low"

export type TaskList = "Personal" | "Work" | "Shopping" | "Health"

export interface Task {
  id: string
  title: string
  completed: boolean
  starred: boolean
  priority: Priority
  list: TaskList
  /** ISO date string e.g. "2026-06-07" */
  dueDate: string | null
}

export const TASK_LISTS: TaskList[] = ["Personal", "Work", "Shopping", "Health"]

export const LIST_COLORS: Record<TaskList, string> = {
  Personal: "bg-violet-500",
  Work: "bg-blue-500",
  Shopping: "bg-green-500",
  Health: "bg-rose-500",
}

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    title: "Finish dashboard design mockups",
    completed: false,
    starred: true,
    priority: "High",
    list: "Work",
    dueDate: "2026-06-07",
  },
  {
    id: "t2",
    title: "Buy groceries for the week",
    completed: false,
    starred: false,
    priority: "Medium",
    list: "Shopping",
    dueDate: "2026-06-07",
  },
  {
    id: "t3",
    title: "Review pull requests",
    completed: true,
    starred: false,
    priority: "High",
    list: "Work",
    dueDate: "2026-06-06",
  },
  {
    id: "t4",
    title: "Schedule dentist appointment",
    completed: false,
    starred: false,
    priority: "Low",
    list: "Health",
    dueDate: "2026-06-08",
  },
  {
    id: "t5",
    title: "Read 30 minutes before bed",
    completed: false,
    starred: false,
    priority: "Low",
    list: "Personal",
    dueDate: null,
  },
  {
    id: "t6",
    title: "Prepare Q2 performance report",
    completed: false,
    starred: true,
    priority: "High",
    list: "Work",
    dueDate: "2026-06-10",
  },
  {
    id: "t7",
    title: "Morning run – 5 km",
    completed: true,
    starred: false,
    priority: "Medium",
    list: "Health",
    dueDate: "2026-06-07",
  },
  {
    id: "t8",
    title: "Pick up dry cleaning",
    completed: false,
    starred: false,
    priority: "Low",
    list: "Shopping",
    dueDate: "2026-06-08",
  },
  {
    id: "t9",
    title: "Call mum",
    completed: false,
    starred: true,
    priority: "Medium",
    list: "Personal",
    dueDate: "2026-06-07",
  },
  {
    id: "t10",
    title: "Book team lunch venue",
    completed: false,
    starred: false,
    priority: "Medium",
    list: "Work",
    dueDate: "2026-06-09",
  },
]
