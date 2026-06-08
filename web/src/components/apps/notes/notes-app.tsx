"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Search,
  Star,
  Archive,
  FileText,
  Plus,
  NotebookPen,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  INITIAL_NOTES,
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_BADGE_CLASSES,
  type Note,
  type Category,
} from "./data"

type SectionFilter = "all" | "starred" | "archived"

let noteCounter = 100

function makeNewNote(): Note {
  noteCounter++
  return {
    id: `new-${noteCounter}`,
    title: "Untitled Note",
    preview: "",
    body: "",
    categories: [],
    date: "2025-12-14",
    starred: false,
    archived: false,
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  notes: Note[]
  section: SectionFilter
  categoryFilter: Category | null
  onSectionChange: (s: SectionFilter) => void
  onCategoryChange: (c: Category | null) => void
  onAddNote: () => void
}

function NotesSidebar({
  notes,
  section,
  categoryFilter,
  onSectionChange,
  onCategoryChange,
  onAddNote,
}: SidebarProps) {
  const counts = useMemo(() => {
    const all = notes.filter((n) => !n.archived).length
    const starred = notes.filter((n) => n.starred && !n.archived).length
    const archived = notes.filter((n) => n.archived).length
    const byCategory: Record<string, number> = {}
    for (const cat of CATEGORIES) {
      byCategory[cat] = notes.filter(
        (n) => !n.archived && n.categories.includes(cat)
      ).length
    }
    return { all, starred, archived, byCategory }
  }, [notes])

  const sectionItems: { key: SectionFilter; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "all", label: "All Notes", icon: <FileText className="size-4" />, count: counts.all },
    { key: "starred", label: "Starred", icon: <Star className="size-4" />, count: counts.starred },
    { key: "archived", label: "Archived", icon: <Archive className="size-4" />, count: counts.archived },
  ]

  return (
    <div className="flex h-full flex-col gap-1 p-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="size-4 text-muted-foreground" />
          Notes
        </span>
        <Button size="sm" onClick={onAddNote} className="h-7 gap-1 text-xs px-2">
          <Plus className="size-3" />
          Add Note
        </Button>
      </div>

      {/* Section filters */}
      <nav className="flex flex-col gap-0.5">
        {sectionItems.map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => { onSectionChange(key); onCategoryChange(null) }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              section === key && categoryFilter === null
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {icon}
            <span className="flex-1 text-left">{label}</span>
            <span className="text-xs text-muted-foreground">{count}</span>
          </button>
        ))}
      </nav>

      <Separator className="my-2" />

      {/* Categories */}
      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Categories
      </p>
      <nav className="flex flex-col gap-0.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { onSectionChange("all"); onCategoryChange(cat) }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              categoryFilter === cat
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", CATEGORY_COLORS[cat])} />
            <span className="flex-1 text-left">{cat}</span>
            <span className="text-xs text-muted-foreground">{counts.byCategory[cat]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Note List ────────────────────────────────────────────────────────────────

interface NoteListProps {
  notes: Note[]
  selectedId: string | null
  search: string
  onSearchChange: (v: string) => void
  onSelect: (id: string) => void
}

function NoteList({ notes, selectedId, search, onSearchChange, onSelect }: NoteListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="flex-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notes found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notes.map((note, idx) => (
              <div key={note.id}>
                <button
                  onClick={() => onSelect(note.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors hover:bg-muted/60",
                    selectedId === note.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium leading-tight">
                      {note.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {note.starred && (
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                  </div>

                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {note.preview}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {note.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          CATEGORY_BADGE_CLASSES[cat]
                        )}
                      >
                        {cat}
                      </span>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatDate(note.date)}
                    </span>
                  </div>
                </button>
                {idx < notes.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Note Editor ─────────────────────────────────────────────────────────────

interface NoteEditorProps {
  note: Note | null
  onTitleChange: (id: string, title: string) => void
  onBodyChange: (id: string, body: string) => void
}

function NoteEditor({ note, onTitleChange, onBodyChange }: NoteEditorProps) {
  if (!note) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-8">
        <NotebookPen className="size-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">Select a note to view</p>
        <p className="text-xs text-muted-foreground/70">
          Choose a note from the list or create a new one.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Editor header */}
      <div className="border-b border-border px-6 py-4">
        <Input
          key={note.id}
          value={note.title}
          onChange={(e) => onTitleChange(note.id, e.target.value)}
          className="h-auto border-none bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0 focus-visible:border-none"
          placeholder="Note title…"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {note.categories.map((cat) => (
            <Badge
              key={cat}
              className={cn(
                "h-5 rounded-full border-transparent text-[10px]",
                CATEGORY_BADGE_CLASSES[cat]
              )}
            >
              {cat}
            </Badge>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDate(note.date)}
          </span>
          {note.starred && (
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
          )}
        </div>
      </div>

      {/* Editor body */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          <Textarea
            key={note.id}
            value={note.body}
            onChange={(e) => onBodyChange(note.id, e.target.value)}
            placeholder="Start writing…"
            className="min-h-[400px] resize-none border-none bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-none text-sm leading-relaxed"
          />
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function NotesApp() {
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES)
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_NOTES[0]?.id ?? null)
  const [search, setSearch] = useState("")
  const [section, setSection] = useState<SectionFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null)

  // Filtered list
  const filteredNotes = useMemo(() => {
    let list = notes

    if (section === "starred") {
      list = list.filter((n) => n.starred && !n.archived)
    } else if (section === "archived") {
      list = list.filter((n) => n.archived)
    } else {
      list = list.filter((n) => !n.archived)
    }

    if (categoryFilter) {
      list = list.filter((n) => n.categories.includes(categoryFilter))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.preview.toLowerCase().includes(q)
      )
    }

    return list
  }, [notes, section, categoryFilter, search])

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  )

  const handleAddNote = useCallback(() => {
    const note = makeNewNote()
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
    setSection("all")
    setCategoryFilter(null)
    setSearch("")
  }, [])

  const handleTitleChange = useCallback((id: string, title: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title } : n))
    )
  }, [])

  const handleBodyChange = useCallback((id: string, body: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, body, preview: body.slice(0, 120).replace(/\n/g, " ") } : n
      )
    )
  }, [])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border bg-background">
      {/* Left Sidebar */}
      <div className="hidden w-52 shrink-0 border-r border-border md:block">
        <ScrollArea className="h-full">
          <NotesSidebar
            notes={notes}
            section={section}
            categoryFilter={categoryFilter}
            onSectionChange={setSection}
            onCategoryChange={setCategoryFilter}
            onAddNote={handleAddNote}
          />
        </ScrollArea>
      </div>

      {/* Center Note List */}
      <div className="w-full border-r border-border md:w-72 md:shrink-0">
        <NoteList
          notes={filteredNotes}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
        />
      </div>

      {/* Right Editor Panel */}
      <div className="hidden flex-1 md:block">
        <NoteEditor
          note={selectedNote}
          onTitleChange={handleTitleChange}
          onBodyChange={handleBodyChange}
        />
      </div>
    </div>
  )
}
