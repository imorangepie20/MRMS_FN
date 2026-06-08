import {
  Inbox,
  Search,
  Users,
  ShoppingCart,
  FileX,
  Bell,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Single Empty State Card ─────────────────────────────────────────────────

interface EmptyStateCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  actionLabel: string;
}

function EmptyStateCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  actionLabel,
}: EmptyStateCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div
          className={`flex size-14 items-center justify-center rounded-full ${iconBg}`}
        >
          <Icon className={`size-6 ${iconColor}`} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {description}
          </p>
        </div>
        <Button size="sm" variant="outline">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Empty States Data ────────────────────────────────────────────────────────

const emptyStates: EmptyStateCardProps[] = [
  {
    icon: Inbox,
    iconBg: "bg-violet-100 dark:bg-violet-950",
    iconColor: "text-violet-600 dark:text-violet-400",
    title: "No messages",
    description: "You have no messages yet. Start a conversation.",
    actionLabel: "Compose",
  },
  {
    icon: Search,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
    title: "No results found",
    description: "We couldn't find anything matching your search. Try different keywords.",
    actionLabel: "Clear search",
  },
  {
    icon: Users,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    title: "No team members",
    description: "Your team is empty. Invite colleagues to collaborate.",
    actionLabel: "Invite members",
  },
  {
    icon: ShoppingCart,
    iconBg: "bg-amber-100 dark:bg-amber-950",
    iconColor: "text-amber-600 dark:text-amber-400",
    title: "Your cart is empty",
    description: "You haven't added anything to your cart yet.",
    actionLabel: "Browse products",
  },
  {
    icon: FileX,
    iconBg: "bg-rose-100 dark:bg-rose-950",
    iconColor: "text-rose-600 dark:text-rose-400",
    title: "No files",
    description: "You haven't uploaded any files. Get started now.",
    actionLabel: "Upload file",
  },
  {
    icon: Bell,
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconColor: "text-slate-600 dark:text-slate-400",
    title: "No notifications",
    description: "You're all caught up! Check back later for updates.",
    actionLabel: "Manage alerts",
  },
];

// ─── Empty States Page ────────────────────────────────────────────────────────

export function EmptyStatesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empty States</h1>
        <p className="text-muted-foreground text-sm mt-1">
          A collection of reusable empty-state patterns for your application.
        </p>
      </div>

      {/* Grid of empty-state cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {emptyStates.map((state) => (
          <EmptyStateCard key={state.title} {...state} />
        ))}
      </div>
    </div>
  );
}
