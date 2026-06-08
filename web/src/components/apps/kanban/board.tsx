"use client"

import React, { useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable"
import {
  Filter,
  LayoutGrid,
  List,
  Table2,
  Plus,
  UserPlus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { KanbanColumn } from "./kanban-column"
import { KanbanCardOverlay } from "./kanban-card"
import { initialColumns, type Card, type Column } from "./data"

const ASSIGNEES = [
  { initials: "AM", color: "bg-violet-500" },
  { initials: "BK", color: "bg-sky-500" },
  { initials: "CR", color: "bg-rose-500" },
  { initials: "DL", color: "bg-emerald-500" },
]

/** Find the column that contains a card id */
function findColumnForCard(columns: Column[], cardId: string): Column | undefined {
  return columns.find((col) => col.cards.some((c) => c.id === cardId))
}

/** Find a card by id across all columns */
function findCard(columns: Column[], cardId: string): Card | undefined {
  for (const col of columns) {
    const card = col.cards.find((c) => c.id === cardId)
    if (card) return card
  }
  return undefined
}

let cardCounter = 100

function makeCard(title: string): Card {
  cardCounter++
  return {
    id: `card-${cardCounter}`,
    title,
    description: "No description provided.",
    taskId: Math.random().toString(36).slice(2, 6).toUpperCase(),
    priority: "Medium",
    progress: 0,
    assignees: 1,
    comments: 0,
    attachments: 0,
  }
}

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeView, setActiveView] = useState<"board" | "list" | "table">("board")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = findCard(columns, event.active.id as string)
      setActiveCard(card ?? null)
    },
    [columns]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      const activeColumn = findColumnForCard(columns, activeId)
      if (!activeColumn) return

      // Determine which column we're over
      const overColumn =
        columns.find((col) => col.id === overId) ??
        findColumnForCard(columns, overId)

      if (!overColumn || activeColumn.id === overColumn.id) return

      // Move the card to the target column live (so column highlights update)
      setColumns((prev) => {
        const newCols = prev.map((col) => ({ ...col, cards: [...col.cards] }))
        const srcCol = newCols.find((c) => c.id === activeColumn.id)!
        const dstCol = newCols.find((c) => c.id === overColumn.id)!

        const cardIdx = srcCol.cards.findIndex((c) => c.id === activeId)
        if (cardIdx === -1) return prev

        const [movedCard] = srcCol.cards.splice(cardIdx, 1)

        // Find where to insert in the destination column
        const overCardIdx = dstCol.cards.findIndex((c) => c.id === overId)
        if (overCardIdx >= 0) {
          dstCol.cards.splice(overCardIdx, 0, movedCard)
        } else {
          dstCol.cards.push(movedCard)
        }

        return newCols
      })
    },
    [columns]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveCard(null)

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      if (activeId === overId) return

      const activeColumn = findColumnForCard(columns, activeId)
      if (!activeColumn) return

      // If within-same-column reorder (cross-column already handled in onDragOver)
      const overColumn =
        columns.find((col) => col.id === overId) ??
        findColumnForCard(columns, overId)

      if (!overColumn) return

      if (activeColumn.id === overColumn.id) {
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id !== activeColumn.id) return col
            const oldIdx = col.cards.findIndex((c) => c.id === activeId)
            const newIdx = col.cards.findIndex((c) => c.id === overId)
            if (oldIdx === -1 || newIdx === -1) return col
            return { ...col, cards: arrayMove(col.cards, oldIdx, newIdx) }
          })
        )
      }
      // Cross-column already committed in handleDragOver
    },
    [columns]
  )

  const handleAddCard = useCallback((columnId: string, title: string) => {
    const card = makeCard(title)
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      )
    )
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Kanban Board</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Avatar group */}
          <AvatarGroup>
            {ASSIGNEES.slice(0, 3).map((a) => (
              <Avatar key={a.initials} size="sm">
                <AvatarFallback className={cn("text-white text-xs", a.color)}>
                  {a.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
          <Button variant="outline" size="sm">
            <UserPlus className="size-3.5" />
            Add Assignee
          </Button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-background">
            {(["board", "list", "table"] as const).map((view) => {
              const Icon = view === "board" ? LayoutGrid : view === "list" ? List : Table2
              return (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors first:rounded-l-lg last:rounded-r-lg hover:text-foreground",
                    activeView === view && "bg-muted text-foreground"
                  )}
                  aria-label={`${view} view`}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>

          <Button variant="outline" size="sm">
            <Filter className="size-3.5" />
            Filter
          </Button>

          <Button size="sm">
            <Plus className="size-3.5" />
            Add Board
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onAddCard={handleAddCard}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <KanbanCardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
