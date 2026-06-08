"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  Trash2,
  Heart,
  MessageSquare,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType = "like" | "comment" | "follow" | "mention" | "system";

interface Notification {
  id: string;
  type: NotificationType;
  actor?: string;
  actorInitials?: string;
  actorColor?: string;
  content: string;
  time: string;
  read: boolean;
}

// ─── Inline Data ──────────────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "like",
    actor: "Sofia Davis",
    actorInitials: "SD",
    actorColor: "bg-rose-500",
    content: "liked your post",
    time: "2m ago",
    read: false,
  },
  {
    id: "2",
    type: "comment",
    actor: "Jackson Lee",
    actorInitials: "JL",
    actorColor: "bg-blue-500",
    content: 'commented: "This is exactly what I was looking for, great work!"',
    time: "14m ago",
    read: false,
  },
  {
    id: "3",
    type: "follow",
    actor: "Emma Wilson",
    actorInitials: "EW",
    actorColor: "bg-emerald-500",
    content: "started following you",
    time: "1h ago",
    read: false,
  },
  {
    id: "4",
    type: "mention",
    actor: "Liam Chen",
    actorInitials: "LC",
    actorColor: "bg-violet-500",
    content: "mentioned you in a comment on Dashboard Analytics",
    time: "2h ago",
    read: false,
  },
  {
    id: "5",
    type: "like",
    actor: "Olivia Torres",
    actorInitials: "OT",
    actorColor: "bg-pink-500",
    content: "liked your comment",
    time: "3h ago",
    read: true,
  },
  {
    id: "6",
    type: "system",
    content: "Your password was changed successfully",
    time: "Yesterday",
    read: true,
  },
  {
    id: "7",
    type: "follow",
    actor: "Noah Martinez",
    actorInitials: "NM",
    actorColor: "bg-amber-500",
    content: "started following you",
    time: "Yesterday",
    read: true,
  },
  {
    id: "8",
    type: "comment",
    actor: "Ava Johnson",
    actorInitials: "AJ",
    actorColor: "bg-cyan-500",
    content: 'commented: "Can you share more details about this?"',
    time: "2 days ago",
    read: true,
  },
  {
    id: "9",
    type: "system",
    content: "New login detected from Chrome on macOS",
    time: "2 days ago",
    read: true,
  },
  {
    id: "10",
    type: "mention",
    actor: "Isabella Kim",
    actorInitials: "IK",
    actorColor: "bg-indigo-500",
    content: "mentioned you in Project Roadmap discussion",
    time: "3 days ago",
    read: true,
  },
];

// ─── Notification Icon ────────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: NotificationType }) {
  const map: Record<
    NotificationType,
    { icon: React.ComponentType<{ className?: string }>; bg: string; color: string }
  > = {
    like: { icon: Heart, bg: "bg-rose-100 dark:bg-rose-950", color: "text-rose-600 dark:text-rose-400" },
    comment: { icon: MessageSquare, bg: "bg-blue-100 dark:bg-blue-950", color: "text-blue-600 dark:text-blue-400" },
    follow: { icon: UserPlus, bg: "bg-emerald-100 dark:bg-emerald-950", color: "text-emerald-600 dark:text-emerald-400" },
    mention: { icon: Bell, bg: "bg-violet-100 dark:bg-violet-950", color: "text-violet-600 dark:text-violet-400" },
    system: { icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-950", color: "text-amber-600 dark:text-amber-400" },
  };
  const { icon: Icon, bg, color } = map[type];
  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", bg)}>
      <Icon className={cn("size-4", color)} />
    </div>
  );
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onMarkRead(notification.id)}
      onKeyDown={(e) => e.key === "Enter" && onMarkRead(notification.id)}
      className={cn(
        "flex items-start gap-3 rounded-lg px-3 py-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        notification.read
          ? "hover:bg-muted/50"
          : "bg-muted/40 hover:bg-muted/60"
      )}
    >
      {/* Avatar or icon */}
      {notification.actor ? (
        <Avatar>
          <AvatarFallback
            className={cn(
              "text-white text-xs font-semibold",
              notification.actorColor
            )}
          >
            {notification.actorInitials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <NotificationIcon type={notification.type} />
      )}

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-sm leading-snug">
          {notification.actor && (
            <span className="font-semibold">{notification.actor} </span>
          )}
          <span className="text-muted-foreground">{notification.content}</span>
        </p>
        <p className="text-xs text-muted-foreground">{notification.time}</p>
      </div>

      {/* Unread dot */}
      <div className="flex items-center pt-1 shrink-0">
        {!notification.read && (
          <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
        )}
      </div>
    </div>
  );
}

// ─── Notifications Page ───────────────────────────────────────────────────────

export function NotificationsPage() {
  const [notifications, setNotifications] =
    useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [tab, setTab] = useState<string>("all");

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function clearAll() {
    setNotifications([]);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const mentionCount = notifications.filter(
    (n) => n.type === "mention"
  ).length;

  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.read;
    if (tab === "mentions") return n.type === "mention";
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.`
              : "You're all caught up!"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="size-3.5" />
              Mark all as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + list */}
      <Tabs value={tab} onValueChange={setTab} orientation="horizontal">
        <TabsList
          variant="line"
          className="border-b border-border w-full justify-start rounded-none px-0 h-auto gap-0 overflow-x-auto"
        >
          <TabsTrigger value="all" className="gap-1.5 px-3 py-2 shrink-0">
            All
            {notifications.length > 0 && (
              <span className="ml-1 rounded-md bg-muted px-1.5 py-px text-xs tabular-nums text-muted-foreground">
                {notifications.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-1.5 px-3 py-2 shrink-0">
            Unread
            {unreadCount > 0 && (
              <span className="ml-1 rounded-md bg-primary px-1.5 py-px text-xs tabular-nums text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mentions" className="gap-1.5 px-3 py-2 shrink-0">
            Mentions
            {mentionCount > 0 && (
              <span className="ml-1 rounded-md bg-muted px-1.5 py-px text-xs tabular-nums text-muted-foreground">
                {mentionCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All / Unread / Mentions panels share same rendering */}
        {(["all", "unread", "mentions"] as const).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs text-muted-foreground">
                  {tabValue === "unread"
                    ? "You've read all your notifications."
                    : tabValue === "mentions"
                    ? "No mentions yet."
                    : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-px">
                {filtered.map((notification, index) => (
                  <div key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onMarkRead={markRead}
                    />
                    {index < filtered.length - 1 && (
                      <Separator className="my-px" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
