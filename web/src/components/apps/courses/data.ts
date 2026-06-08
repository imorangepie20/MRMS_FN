export type Category =
  | "Design"
  | "Development"
  | "Marketing"
  | "Business"
  | "Photography"

export type EnrollmentStatus = "not-enrolled" | "in-progress" | "completed"

export interface Course {
  id: string
  title: string
  instructorName: string
  instructorRole: string
  /** initials for avatar fallback */
  instructorInitials: string
  category: Category
  /** tailwind gradient classes for thumbnail */
  gradient: string
  rating: number
  /** formatted e.g. "12.5k" */
  students: string
  /** formatted e.g. "8h 20m" */
  duration: string
  price: string
  status: EnrollmentStatus
  /** 0-100, only meaningful when status !== "not-enrolled" */
  progress: number
}

export const CATEGORIES: (Category | "All")[] = [
  "All",
  "Design",
  "Development",
  "Marketing",
  "Business",
  "Photography",
]

export const COURSES: Course[] = [
  {
    id: "c1",
    title: "Mastering Illustration",
    instructorName: "Simon Simorangkir",
    instructorRole: "Mentor • Illustrator at Google",
    instructorInitials: "SS",
    category: "Design",
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    rating: 4.8,
    students: "12.5k",
    duration: "8h 20m",
    price: "$49",
    status: "in-progress",
    progress: 55,
  },
  {
    id: "c2",
    title: "Advanced React Patterns",
    instructorName: "Priya Sharma",
    instructorRole: "Senior Engineer at Meta",
    instructorInitials: "PS",
    category: "Development",
    gradient: "from-cyan-500 via-blue-500 to-blue-700",
    rating: 4.9,
    students: "9.2k",
    duration: "11h 45m",
    price: "$59",
    status: "in-progress",
    progress: 30,
  },
  {
    id: "c3",
    title: "UI/UX Design Fundamentals",
    instructorName: "Aisha Okonkwo",
    instructorRole: "Lead Designer at Figma",
    instructorInitials: "AO",
    category: "Design",
    gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
    rating: 4.7,
    students: "18.3k",
    duration: "6h 10m",
    price: "$39",
    status: "completed",
    progress: 100,
  },
  {
    id: "c4",
    title: "Digital Marketing 101",
    instructorName: "Marcus Webb",
    instructorRole: "Growth Lead at HubSpot",
    instructorInitials: "MW",
    category: "Marketing",
    gradient: "from-orange-400 via-amber-500 to-yellow-500",
    rating: 4.5,
    students: "7.8k",
    duration: "5h 30m",
    price: "$29",
    status: "not-enrolled",
    progress: 0,
  },
  {
    id: "c5",
    title: "Photography Masterclass",
    instructorName: "Lena Hoffmann",
    instructorRole: "Award-winning Photographer",
    instructorInitials: "LH",
    category: "Photography",
    gradient: "from-emerald-400 via-teal-500 to-green-600",
    rating: 4.9,
    students: "14.1k",
    duration: "10h 00m",
    price: "$69",
    status: "not-enrolled",
    progress: 0,
  },
  {
    id: "c6",
    title: "Business Strategy",
    instructorName: "David Chen",
    instructorRole: "Strategy Consultant, ex-McKinsey",
    instructorInitials: "DC",
    category: "Business",
    gradient: "from-slate-500 via-zinc-600 to-neutral-700",
    rating: 4.6,
    students: "5.4k",
    duration: "7h 15m",
    price: "$79",
    status: "not-enrolled",
    progress: 0,
  },
  {
    id: "c7",
    title: "Python for Data Science",
    instructorName: "Yuki Tanaka",
    instructorRole: "Data Scientist at Stripe",
    instructorInitials: "YT",
    category: "Development",
    gradient: "from-sky-400 via-cyan-500 to-teal-600",
    rating: 4.8,
    students: "21.0k",
    duration: "14h 30m",
    price: "$55",
    status: "not-enrolled",
    progress: 0,
  },
  {
    id: "c8",
    title: "Brand Identity Design",
    instructorName: "Sofia Russo",
    instructorRole: "Creative Director at Pentagram",
    instructorInitials: "SR",
    category: "Design",
    gradient: "from-pink-400 via-rose-500 to-red-600",
    rating: 4.7,
    students: "8.9k",
    duration: "9h 05m",
    price: "$45",
    status: "not-enrolled",
    progress: 0,
  },
  {
    id: "c9",
    title: "Motion Graphics",
    instructorName: "Alex Petrov",
    instructorRole: "Motion Designer at Apple",
    instructorInitials: "AP",
    category: "Design",
    gradient: "from-indigo-400 via-violet-500 to-purple-700",
    rating: 4.6,
    students: "6.3k",
    duration: "12h 20m",
    price: "$65",
    status: "not-enrolled",
    progress: 0,
  },
]
