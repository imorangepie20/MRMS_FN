"use client"

import React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MessageSquare, Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import type { Card } from "./data"

const PRIORITY_INITIALS = ["AM", "BK", "CR", "DL"]

function PriorityBadge({ priority }: { priority: Card["priority"] }) {
  return (
    <Badge
      className={cn(
        priority === "High" &&
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        priority === "Medium" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        priority === "Low" &&
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      )}
    >
      {priority}
    </Badge>
  )
}

interface KanbanCardProps {
  card: Card
  isDragOverlay?: boolean
}

export function KanbanCard({ card, isDragOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={cn(
        "group/card flex flex-col gap-3 rounded-xl bg-card p-3.5 text-sm text-card-foreground ring-1 ring-foreground/10 cursor-grab select-none",
        isDragOverlay && "rotate-1 shadow-xl cursor-grabbing ring-primary/30",
        isDragging && "ring-primary/30"
      )}
    >
      {/* Priority + task ID row */}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={card.priority} />
        <span className="font-mono text-xs text-muted-foreground">{card.taskId}</span>
      </div>

      {/* Title */}
      <div className="font-medium leading-snug">{card.title}</div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${card.progress}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
          {card.progress}%
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Avatar stack */}
        <AvatarGroup>
          {Array.from({ length: Math.min(card.assignees, 3) }).map((_, i) => (
            <Avatar key={i} size="sm">
              <AvatarFallback>{PRIORITY_INITIALS[i]}</AvatarFallback>
            </Avatar>
          ))}
          {card.assignees > 3 && (
            <div className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-background">
              +{card.assignees - 3}
            </div>
          )}
        </AvatarGroup>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {card.comments}
          </span>
          <span className="flex items-center gap-1">
            <Paperclip className="size-3.5" />
            {card.attachments}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Lightweight clone used in DragOverlay (no sortable hooks) */
export function KanbanCardOverlay({ card }: { card: Card }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-3.5 text-sm text-card-foreground shadow-xl ring-1 ring-primary/30 rotate-1 cursor-grabbing select-none">
      <div className="flex items-center justify-between">
        <PriorityBadge priority={card.priority} />
        <span className="font-mono text-xs text-muted-foreground">{card.taskId}</span>
      </div>
      <div className="font-medium leading-snug">{card.title}</div>
      <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
      <div className="flex items-center gap-2">
        <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${card.progress}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
          {card.progress}%
        </span>
      </div>
      <div className="flex items-center justify-between">
        <AvatarGroup>
          {Array.from({ length: Math.min(card.assignees, 3) }).map((_, i) => (
            <Avatar key={i} size="sm">
              <AvatarFallback>{PRIORITY_INITIALS[i]}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {card.comments}
          </span>
          <span className="flex items-center gap-1">
            <Paperclip className="size-3.5" />
            {card.attachments}
          </span>
        </div>
      </div>
    </div>
  )
}
