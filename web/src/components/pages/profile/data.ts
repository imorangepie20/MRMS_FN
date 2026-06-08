// ─── Profile Mock Data ────────────────────────────────────────────────────────

export type Skill = {
  name: string;
  level: number; // 0–100
};

export type ActivityItem = {
  id: string;
  type: "post" | "comment" | "like" | "project" | "follow";
  text: string;
  time: string;
  avatar?: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  collaborators: number;
  status: "active" | "completed" | "archived";
  updatedAt: string;
};

export type Connection = {
  id: string;
  name: string;
  headline: string;
  initials: string;
  color: string;
};

// ─── User ─────────────────────────────────────────────────────────────────────

export const profile = {
  name: "Sofia Davis",
  headline: "Product Designer",
  bio: "Passionate about crafting intuitive, pixel-perfect interfaces that bridge business goals with delightful user experiences. 8+ years of experience shipping design systems, SaaS dashboards, and mobile apps at scale. I live at the intersection of design and engineering—comfortable in Figma, React, and everything in between.",
  location: "San Francisco, CA",
  website: "sofiadavis.design",
  email: "sofia@sofiadavis.design",
  phone: "+1 (415) 555-0182",
  joined: "January 2019",
  followers: 4218,
  following: 312,
  posts: 186,
  avatar: "SD",
  avatarColor: "from-violet-500 to-indigo-600",
};

// ─── Skills ───────────────────────────────────────────────────────────────────

export const skills: Skill[] = [
  { name: "UI Design", level: 95 },
  { name: "UX Research", level: 82 },
  { name: "Figma", level: 98 },
  { name: "Design Systems", level: 90 },
  { name: "Prototyping", level: 87 },
  { name: "React", level: 74 },
  { name: "Tailwind CSS", level: 81 },
  { name: "TypeScript", level: 65 },
  { name: "Accessibility", level: 88 },
  { name: "Motion Design", level: 76 },
];

export const skillTags = [
  "UI/UX Design",
  "Design Systems",
  "Figma",
  "Prototyping",
  "User Research",
  "Accessibility",
  "React",
  "Tailwind CSS",
  "TypeScript",
  "Motion Design",
  "Information Architecture",
  "A/B Testing",
];

// ─── Activity ─────────────────────────────────────────────────────────────────

export const activityItems: ActivityItem[] = [
  {
    id: "a1",
    type: "post",
    text: 'Published a new article: "Designing for Scale: Lessons from Building a 50-Component System"',
    time: "2 hours ago",
  },
  {
    id: "a2",
    type: "project",
    text: "Completed a milestone on Horizon Dashboard — shipped dark mode support to 12,000+ users.",
    time: "Yesterday",
  },
  {
    id: "a3",
    type: "comment",
    text: 'Left a detailed comment on Marcus Lee\'s post "The future of AI-assisted design tools"',
    time: "2 days ago",
  },
  {
    id: "a4",
    type: "follow",
    text: "Started following 3 new designers: Ana Souza, James Park, and Lena Fischer.",
    time: "3 days ago",
  },
  {
    id: "a5",
    type: "like",
    text: 'Liked "Component-driven development patterns" by the Storybook team.',
    time: "4 days ago",
  },
  {
    id: "a6",
    type: "project",
    text: "Launched a new open-source project: Aurora Icon Set — 300+ hand-crafted SVG icons.",
    time: "1 week ago",
  },
  {
    id: "a7",
    type: "post",
    text: 'Shared a case study: "How we reduced onboarding drop-off by 38%"',
    time: "1 week ago",
  },
];

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: "p1",
    name: "Horizon Dashboard",
    description:
      "A full-featured SaaS admin dashboard with 15+ page templates, dark mode, and a 50-component design system.",
    tags: ["Design System", "SaaS", "Figma"],
    collaborators: 5,
    status: "active",
    updatedAt: "2 days ago",
  },
  {
    id: "p2",
    name: "Aurora Icon Set",
    description:
      "300+ hand-crafted SVG icons with consistent 24px grid, multiple weights, and React component exports.",
    tags: ["Open Source", "Icons", "React"],
    collaborators: 3,
    status: "active",
    updatedAt: "1 week ago",
  },
  {
    id: "p3",
    name: "Clarity Design Tokens",
    description:
      "A token-based design system foundation with automated Figma Variables sync and multi-brand theming.",
    tags: ["Design Tokens", "Theming", "Automation"],
    collaborators: 8,
    status: "completed",
    updatedAt: "3 weeks ago",
  },
  {
    id: "p4",
    name: "Motion Playbook",
    description:
      "Principles, guidelines, and code examples for consistent animation across product surfaces.",
    tags: ["Motion", "Guidelines", "Framer"],
    collaborators: 2,
    status: "active",
    updatedAt: "5 days ago",
  },
  {
    id: "p5",
    name: "Aria Accessible Components",
    description:
      "Production-ready React components with full WCAG 2.1 AA compliance and keyboard navigation.",
    tags: ["Accessibility", "React", "WCAG"],
    collaborators: 4,
    status: "completed",
    updatedAt: "2 months ago",
  },
  {
    id: "p6",
    name: "Onboarding Flow Redesign",
    description:
      "Full redesign of a B2B SaaS onboarding experience that reduced drop-off by 38% in A/B tests.",
    tags: ["UX Research", "SaaS", "A/B Testing"],
    collaborators: 6,
    status: "archived",
    updatedAt: "4 months ago",
  },
];

// ─── Connections ──────────────────────────────────────────────────────────────

export const connections: Connection[] = [
  { id: "c1", name: "Marcus Lee", headline: "Frontend Engineer", initials: "ML", color: "bg-blue-500" },
  { id: "c2", name: "Ana Souza", headline: "UX Researcher", initials: "AS", color: "bg-emerald-500" },
  { id: "c3", name: "James Park", headline: "Product Manager", initials: "JP", color: "bg-amber-500" },
  { id: "c4", name: "Lena Fischer", headline: "Brand Designer", initials: "LF", color: "bg-pink-500" },
  { id: "c5", name: "Tyler Chen", headline: "Full-Stack Dev", initials: "TC", color: "bg-violet-500" },
  { id: "c6", name: "Priya Kapoor", headline: "Data Scientist", initials: "PK", color: "bg-orange-500" },
  { id: "c7", name: "Diego Ruiz", headline: "Motion Designer", initials: "DR", color: "bg-cyan-500" },
  { id: "c8", name: "Hana Yamamoto", headline: "iOS Developer", initials: "HY", color: "bg-rose-500" },
  { id: "c9", name: "Ben Okafor", headline: "DevOps Engineer", initials: "BO", color: "bg-teal-500" },
];
