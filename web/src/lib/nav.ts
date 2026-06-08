import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ShoppingCart, CreditCard, Hotel, KanbanSquare,
  Building2, TrendingUp, Users, BarChart3, FolderOpen, Bitcoin,
  GraduationCap, Stethoscope, Wallet, StickyNote, MessageSquare,
  Share2, Mail, ListTodo, CheckSquare, Calendar, KeyRound, Store,
  BookOpen, Bot, Image as ImageIcon, AudioLines, UserCircle, Rocket,
  Layers, Settings, Tag, ShieldCheck, Bell, TriangleAlert, Boxes,
  Component, Blocks, FlaskConical, Globe,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon?: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Dashboards",
    items: [
      { title: "Default", href: "/dashboard/default", icon: LayoutDashboard },
      { title: "E-commerce", href: "/dashboard/ecommerce", icon: ShoppingCart },
      { title: "Payment", href: "/dashboard/payment", icon: CreditCard },
      { title: "Hotel", href: "/dashboard/hotel", icon: Hotel },
      { title: "Project Management", href: "/dashboard/project-management", icon: KanbanSquare },
      { title: "Real Estate", href: "/dashboard/real-estate", icon: Building2 },
      { title: "Sales", href: "/dashboard/sales", icon: TrendingUp },
      { title: "CRM", href: "/dashboard/crm", icon: Users },
      { title: "Website Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { title: "File Manager", href: "/dashboard/file-manager", icon: FolderOpen },
      { title: "Crypto", href: "/dashboard/crypto", icon: Bitcoin },
      { title: "Academy", href: "/dashboard/academy", icon: GraduationCap },
      { title: "Hospital", href: "/dashboard/hospital", icon: Stethoscope },
      { title: "Finance", href: "/dashboard/finance", icon: Wallet },
    ],
  },
  {
    label: "Apps",
    items: [
      { title: "Kanban", href: "/apps/kanban", icon: KanbanSquare },
      { title: "Notes", href: "/apps/notes", icon: StickyNote },
      { title: "Chats", href: "/apps/chats", icon: MessageSquare },
      { title: "Social Media", href: "/apps/social", icon: Share2 },
      { title: "Mail", href: "/apps/mail", icon: Mail },
      { title: "Todo List", href: "/apps/todo", icon: ListTodo },
      { title: "Tasks", href: "/apps/tasks", icon: CheckSquare },
      { title: "Calendar", href: "/apps/calendar", icon: Calendar },
      { title: "File Manager", href: "/apps/file-manager", icon: FolderOpen },
      { title: "API Keys", href: "/apps/api-keys", icon: KeyRound },
      { title: "POS", href: "/apps/pos", icon: Store },
      { title: "Courses", href: "/apps/courses", icon: BookOpen },
    ],
  },
  {
    label: "AI Apps",
    items: [
      { title: "AI Chat", href: "/ai/chat", icon: Bot },
      { title: "AI Chat V2", href: "/ai/chat-v2", icon: Bot },
      { title: "Image Generator", href: "/ai/image-generator", icon: ImageIcon },
      { title: "Text to Speech", href: "/ai/text-to-speech", icon: AudioLines },
    ],
  },
  {
    label: "Pages",
    items: [
      { title: "Users List", href: "/users", icon: Users },
      { title: "Profile V1", href: "/profile", icon: UserCircle },
      { title: "Profile V2", href: "/profile/v2", icon: UserCircle },
      { title: "Onboarding", href: "/onboarding", icon: Rocket },
      { title: "Empty States", href: "/empty-states", icon: Layers },
      { title: "Settings", href: "/settings", icon: Settings },
      { title: "Pricing", href: "/pricing", icon: Tag },
      { title: "Authentication", href: "/login", icon: ShieldCheck },
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Error Pages", href: "/error/404", icon: TriangleAlert },
    ],
  },
  {
    label: "Others",
    items: [
      { title: "Widgets", href: "/widgets", icon: Boxes },
      { title: "Components", href: "/components", icon: Component },
      { title: "Blocks", href: "/blocks", icon: Blocks },
      { title: "Examples", href: "/examples", icon: FlaskConical },
      { title: "Website Templates", href: "/templates", icon: Globe },
    ],
  },
];

// Auth routes live outside the dashboard shell (the (auth) group).
export const authRoutes: NavItem[] = [
  { title: "Login", href: "/login" },
  { title: "Register", href: "/register" },
  { title: "Forgot Password", href: "/forgot-password" },
  { title: "Reset Password", href: "/reset-password" },
  { title: "Verify Email", href: "/verify" },
];

// Flat list of every dashboard-shell route (used by ⌘K and stub generation).
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
