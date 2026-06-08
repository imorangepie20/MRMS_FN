// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  rank: number;
  initials: string;
  name: string;
  points: number;
  color: string;
};

export type CourseRow = {
  name: string;
  category: string;
  score: number;
  progress: number;
};

export type ActivityBreakdownEntry = {
  name: string;
  value: number;
  fill: string;
};

export type CourseProgressPoint = {
  date: string;
  courses: number;
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, initials: "LS", name: "Liam Smith",    points: 5000, color: "bg-violet-200 text-violet-700" },
  { rank: 2, initials: "EB", name: "Emma Brown",    points: 4800, color: "bg-blue-200 text-blue-700" },
  { rank: 3, initials: "NJ", name: "Noah Johnson",  points: 4600, color: "bg-emerald-200 text-emerald-700" },
  { rank: 4, initials: "OD", name: "Olivia Davis",  points: 4400, color: "bg-amber-200 text-amber-700" },
];

// ─── Popular Courses ──────────────────────────────────────────────────────────

export const popularCourses: CourseRow[] = [
  { name: "React for Beginners",        category: "Development", score: 4.8, progress: 92 },
  { name: "UI/UX Design Fundamentals",  category: "Design",      score: 4.7, progress: 75 },
  { name: "Digital Marketing Basics",   category: "Marketing",   score: 4.5, progress: 60 },
  { name: "Startup Strategy",           category: "Business",    score: 4.3, progress: 45 },
  { name: "Advanced TypeScript",        category: "Development", score: 4.6, progress: 83 },
  { name: "Brand Identity Design",      category: "Design",      score: 4.2, progress: 38 },
];

// ─── Activity Breakdown ───────────────────────────────────────────────────────

export const activityBreakdown: ActivityBreakdownEntry[] = [
  { name: "Mentoring",    value: 65.2, fill: "var(--chart-1)" },
  { name: "Organization", value: 25.0, fill: "var(--chart-2)" },
  { name: "Planning",     value: 9.8,  fill: "var(--chart-3)" },
];

// ─── Course Progress by Month ─────────────────────────────────────────────────

export const courseProgressData: CourseProgressPoint[] = [
  { date: "11 May",  courses: 18 },
  { date: "14 May",  courses: 22 },
  { date: "17 May",  courses: 19 },
  { date: "20 May",  courses: 25 },
  { date: "23 May",  courses: 28 },
  { date: "26 May",  courses: 24 },
  { date: "29 May",  courses: 31 },
  { date: "01 Jun",  courses: 29 },
  { date: "03 Jun",  courses: 35 },
  { date: "05 Jun",  courses: 33 },
  { date: "06 Jun",  courses: 38 },
  { date: "07 Jun",  courses: 27 },
];
