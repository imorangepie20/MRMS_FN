"use client"

import React, { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KanbanCard } from "./kanban-card"
import type { Card, Column } from "./data"

interface KanbanColumnProps {
  column: Column
  onAddCard: (columnId: string, title: string) => void
}

export function KanbanColumn({ column, onAddCard }: KanbanColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")

  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const cardIds = column.cards.map((c) => c.id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (trimmed) {
      onAddCard(column.id, trimmed)
      setNewTitle("")
      setIsAdding(false)
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{column.title}</span>
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
            {column.cards.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAdding(true)}
          aria-label={`Add card to ${column.title}`}
        >
          <Plus />
        </Button>
      </div>

      {/* Card list (droppable + sortable) */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 rounded-xl p-2 min-h-[80px] transition-colors",
          isOver && "bg-muted/60 ring-2 ring-primary/20"
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {/* Empty state placeholder */}
        {column.cards.length === 0 && !isAdding && (
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted py-6 text-xs text-muted-foreground">
            No cards
          </div>
        )}

        {/* Add card input */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Card title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setIsAdding(false)}
            />
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" className="flex-1">
                Add card
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setIsAdding(false)
                  setNewTitle("")
                }}
              >
                <X />
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Column footer — always-visible "Add a card" affordance */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add a card
        </button>
      )}
    </div>
  )
}
