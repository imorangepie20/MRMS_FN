// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus = "In Progress" | "Completed" | "On Hold";

export type Project = {
  name: string;
  client: string;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  progress: number;
};

export type ReminderPriority = "Low" | "Medium" | "High";

export type Reminder = {
  title: string;
  due: string;
  priority: ReminderPriority;
};

// ─── Projects Overview Chart Data ─────────────────────────────────────────────

export const projectsOverview3Months = [
  { month: "Jan", projects: 18 },
  { month: "Feb", projects: 24 },
  { month: "Mar", projects: 15 },
  { month: "Apr", projects: 32 },
  { month: "May", projects: 27 },
  { month: "Jun", projects: 40 },
  { month: "Jul", projects: 35 },
  { month: "Aug", projects: 22 },
  { month: "Sep", projects: 38 },
  { month: "Oct", projects: 45 },
  { month: "Nov", projects: 33 },
  { month: "Dec", projects: 51 },
];

export const projectsOverview30Days = [
  { month: "W1",  projects: 12 },
  { month: "W2",  projects: 18 },
  { month: "W3",  projects: 22 },
  { month: "W4",  projects: 15 },
];

export const projectsOverview7Days = [
  { month: "Mon", projects: 4  },
  { month: "Tue", projects: 7  },
  { month: "Wed", projects: 3  },
  { month: "Thu", projects: 9  },
  { month: "Fri", projects: 6  },
  { month: "Sat", projects: 2  },
  { month: "Sun", projects: 1  },
];

// ─── Achievement by Year ──────────────────────────────────────────────────────

export const achievementByYear = [
  { month: "January",  achieved: 57 },
  { month: "February", achieved: 29 },
  { month: "March",    achieved: 35 },
  { month: "April",    achieved: 48 },
  { month: "May",      achieved: 62 },
  { month: "June",     achieved: 41 },
];

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminders: Reminder[] = [
  {
    title: "Submit quarterly project report",
    due: "Due today",
    priority: "High",
  },
  {
    title: "Team meeting with stakeholders",
    due: "Due tomorrow",
    priority: "Medium",
  },
  {
    title: "Review updated project scope",
    due: "Due in 3 days",
    priority: "Low",
  },
];

// ─── Recent Projects ──────────────────────────────────────────────────────────

export const recentProjects: Project[] = [
  {
    name: "Brand Identity Redesign",
    client: "Acme Corp",
    startDate: "Jan 5, 2026",
    deadline: "Mar 15, 2026",
    status: "In Progress",
    progress: 30,
  },
  {
    name: "E-commerce Platform",
    client: "ShopNow Inc",
    startDate: "Nov 1, 2025",
    deadline: "Feb 28, 2026",
    status: "In Progress",
    progress: 60,
  },
  {
    name: "Mobile App Launch",
    client: "TechStart Ltd",
    startDate: "Sep 15, 2025",
    deadline: "Jan 31, 2026",
    status: "Completed",
    progress: 100,
  },
  {
    name: "Marketing Campaign",
    client: "GrowthCo",
    startDate: "Feb 10, 2026",
    deadline: "Apr 30, 2026",
    status: "In Progress",
    progress: 50,
  },
  {
    name: "Data Migration",
    client: "DataVault Systems",
    startDate: "Dec 1, 2025",
    deadline: "Mar 1, 2026",
    status: "On Hold",
    progress: 45,
  },
  {
    name: "SEO Optimization",
    client: "RankUp Agency",
    startDate: "Mar 1, 2026",
    deadline: "Jun 15, 2026",
    status: "In Progress",
    progress: 20,
  },
];
