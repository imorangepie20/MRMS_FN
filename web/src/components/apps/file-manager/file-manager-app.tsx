"use client"

import React, { useState, useMemo } from "react"
import {
  Folder,
  FileText,
  ImageIcon,
  Music,
  Video,
  Upload,
  LayoutGrid,
  List,
  Search,
  MoreHorizontal,
  ChevronRight,
  HardDrive,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import {
  fileItems,
  sidebarTree,
  storageUsedGB,
  storageTotalGB,
  type FileItem,
  type FolderNode,
} from "./data"

// ─── Sidebar Folder Tree ───────────────────────────────────────────────────────

function FolderTreeItem({
  node,
  depth = 0,
  activeFolderId,
  onSelect,
}: {
  node: FolderNode
  depth?: number
  activeFolderId: string
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0
  const isActive = activeFolderId === node.id

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.id)
          if (hasChildren) setExpanded((prev) => !prev)
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          depth > 0 ? "ml-4 w-[calc(100%-1rem)]" : "",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform text-muted-foreground/60",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <Folder className="size-4 shrink-0 text-amber-500" />
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && expanded && (
        <div className="mt-0.5 space-y-0.5">
          {node.children!.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── File Icon by Kind ─────────────────────────────────────────────────────────

function KindIcon({ kind, className }: { kind: FileItem["kind"]; className?: string }) {
  const cls = cn("shrink-0", className)
  switch (kind) {
    case "folder":
      return <Folder className={cn(cls, "text-amber-500")} />
    case "document":
      return <FileText className={cn(cls, "text-blue-500")} />
    case "image":
      return <ImageIcon className={cn(cls, "text-emerald-500")} />
    case "music":
      return <Music className={cn(cls, "text-violet-500")} />
    case "video":
      return <Video className={cn(cls, "text-rose-500")} />
    default:
      return <FileText className={cls} />
  }
}

// ─── Item Action Dropdown ──────────────────────────────────────────────────────

function ItemActions({ item }: { item: FileItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover/item:opacity-100 focus:opacity-100 shrink-0"
            aria-label="More actions"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem>Open</DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>Share</DropdownMenuItem>
        <DropdownMenuItem>Download</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({ item }: { item: FileItem }) {
  return (
    <div className="group/item relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:bg-accent/30 hover:border-accent cursor-default">
      <div className="absolute top-2 right-2">
        <ItemActions item={item} />
      </div>

      {item.kind === "folder" ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10">
          <Folder className="size-8 text-amber-500" />
        </div>
      ) : (
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            item.kind === "document" && "bg-blue-500/10",
            item.kind === "image" && "bg-emerald-500/10",
            item.kind === "music" && "bg-violet-500/10",
            item.kind === "video" && "bg-rose-500/10"
          )}
        >
          <KindIcon kind={item.kind} className="size-8" />
        </div>
      )}

      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium text-foreground leading-tight">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.kind === "folder" ? `${item.itemCount} items` : item.size}
        </p>
      </div>
    </div>
  )
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, isLast }: { item: FileItem; isLast: boolean }) {
  return (
    <>
      <div className="group/item flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 rounded-lg cursor-default transition-colors">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            item.kind === "folder" && "bg-amber-500/10",
            item.kind === "document" && "bg-blue-500/10",
            item.kind === "image" && "bg-emerald-500/10",
            item.kind === "music" && "bg-violet-500/10",
            item.kind === "video" && "bg-rose-500/10"
          )}
        >
          <KindIcon kind={item.kind} className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        </div>

        <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground shrink-0">
          <span className="w-16 text-right">
            {item.kind === "folder" ? `${item.itemCount} items` : item.size}
          </span>
          <span className="w-20 text-right">{item.modified}</span>
        </div>

        <ItemActions item={item} />
      </div>
      {!isLast && <Separator />}
    </>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function FileManagerApp() {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [search, setSearch] = useState("")
  const [activeFolderId, setActiveFolderId] = useState("documents")
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "size" | "modified">("name-asc")

  const folderNameMap: Record<string, string> = {
    documents: "Documents",
    "documents-design": "Design",
    "documents-projects": "Projects",
    downloads: "Downloads",
    pictures: "Pictures",
    "pictures-screenshots": "Screenshots",
    "pictures-wallpapers": "Wallpapers",
    music: "Music",
    "music-albums": "Albums",
  }

  const activeFolderName = folderNameMap[activeFolderId] ?? "Documents"

  const storagePercent = Math.round((storageUsedGB / storageTotalGB) * 100)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = q
      ? fileItems.filter((item) => item.name.toLowerCase().includes(q))
      : fileItems

    const folders = items.filter((i) => i.kind === "folder")
    const files = items.filter((i) => i.kind !== "folder")

    const sortFn = (a: FileItem, b: FileItem) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name)
      if (sort === "name-desc") return b.name.localeCompare(a.name)
      if (sort === "size") return (a.size ?? "").localeCompare(b.size ?? "")
      if (sort === "modified") return b.modified.localeCompare(a.modified)
      return 0
    }

    return [...folders.sort(sortFn), ...files.sort(sortFn)]
  }, [search, sort])

  const total = fileItems.length
  const shown = filteredItems.length

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-4 border-r border-border bg-card/40 p-4 overflow-y-auto">
        <div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Folders
          </p>
          <nav className="space-y-0.5">
            {sidebarTree.map((node) => (
              <FolderTreeItem
                key={node.id}
                node={node}
                activeFolderId={activeFolderId}
                onSelect={setActiveFolderId}
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto">
          <Separator className="mb-4" />
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm">Storage</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={storagePercent} className="gap-0">
                <ProgressTrack className="h-1.5">
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{storageUsedGB} GB</span> of{" "}
                {storageTotalGB} GB used
              </p>
            </CardContent>
          </Card>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveFolderId("documents")
                    }}
                  >
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeFolderName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Upload button */}
            <Button size="sm" className="gap-1.5">
              <Upload className="size-3.5" />
              Upload
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" />
                }
              >
                {sort === "name-asc" && "Name ↑"}
                {sort === "name-desc" && "Name ↓"}
                {sort === "size" && "Size"}
                {sort === "modified" && "Modified"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => setSort("name-asc")}>Name ↑</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("name-desc")}>Name ↓</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("size")}>Size</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("modified")}>Modified</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="size-3.5" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
              >
                <List className="size-3.5" />
              </Button>
            </div>

            {/* Item count */}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {shown === total ? `${total} items` : `${shown} of ${total} items`}
            </span>
          </div>
        </div>

        {/* File Display */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No files match &ldquo;{search}&rdquo;
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {filteredItems.map((item) => (
                <GridCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* List header */}
              <div className="hidden sm:flex items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
                <div className="size-8 shrink-0" />
                <span className="flex-1">Name</span>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="w-16 text-right">Size</span>
                  <span className="w-20 text-right">Modified</span>
                </div>
                <div className="size-7 shrink-0" />
              </div>
              <div className="p-1.5">
                {filteredItems.map((item, idx) => (
                  <ListRow
                    key={item.id}
                    item={item}
                    isLast={idx === filteredItems.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
