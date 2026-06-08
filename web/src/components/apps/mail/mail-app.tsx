"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Search,
  Archive,
  Trash2,
  AlertOctagon,
  Clock,
  Reply,
  ReplyAll,
  Forward,
  MoreHorizontal,
  PencilLine,
  Send,
  Mail as MailIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  INITIAL_MAILS,
  FOLDERS,
  CATEGORIES,
  LABEL_COLORS,
  type Mail as MailItem,
  type MailFolder,
  type MailLabel,
} from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatDisplayDate(isoDate: string): string {
  // Parse without relying on timezone-sensitive new Date()
  const [datePart, timePart] = isoDate.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number)
  const d = new Date(year, month - 1, day, hour, minute)
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Mail Sidebar ──────────────────────────────────────────────────────────────

interface MailSidebarProps {
  activeFolder: MailFolder
  onFolderChange: (folder: MailFolder) => void
  onCompose: () => void
}

function MailSidebar({ activeFolder, onFolderChange, onCompose }: MailSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Compose button */}
      <div className="pb-1">
        <Button className="w-full justify-start gap-2" onClick={onCompose}>
          <PencilLine className="size-4" />
          Compose
        </Button>
      </div>

      {/* Folders */}
      <nav className="flex flex-col gap-0.5">
        {FOLDERS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => onFolderChange(id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              activeFolder === id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span className="flex-1 text-left">{label}</span>
            {count != null && (
              <span className="text-xs font-medium tabular-nums">{count}</span>
            )}
          </button>
        ))}
      </nav>

      <Separator className="my-1" />

      {/* Categories */}
      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Categories
      </p>
      <nav className="flex flex-col gap-0.5">
        {CATEGORIES.map(({ id, label, count }) => (
          <button
            key={id}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <span className="flex-1 text-left">{label}</span>
            <span className="text-xs font-medium tabular-nums">{count}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Mail List ─────────────────────────────────────────────────────────────────

interface MailListProps {
  mails: MailItem[]
  selectedId: string | null
  search: string
  tab: "all" | "unread"
  folderLabel: string
  onSearchChange: (v: string) => void
  onTabChange: (t: "all" | "unread") => void
  onSelect: (id: string) => void
}

function LabelBadge({ label }: { label: MailLabel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        LABEL_COLORS[label]
      )}
    >
      {label}
    </span>
  )
}

function MailList({
  mails,
  selectedId,
  search,
  tab,
  folderLabel,
  onSearchChange,
  onTabChange,
  onSelect,
}: MailListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold">{folderLabel}</h2>
        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as "all" | "unread")}
        >
          <TabsList className="h-7">
            <TabsTrigger value="all" className="px-2 py-0.5 text-xs">
              All mail
            </TabsTrigger>
            <TabsTrigger value="unread" className="px-2 py-0.5 text-xs">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Email list */}
      <ScrollArea className="flex-1">
        {mails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MailIcon className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No messages found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {mails.map((mail, idx) => (
              <div key={mail.id}>
                <button
                  onClick={() => onSelect(mail.id)}
                  className={cn(
                    "relative w-full text-left px-4 py-3 transition-colors hover:bg-muted/60",
                    selectedId === mail.id && "bg-muted"
                  )}
                >
                  {/* Unread dot */}
                  {!mail.read && (
                    <span className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-blue-500" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      <AvatarFallback className="bg-muted-foreground/15 text-foreground text-[10px]">
                        {getInitials(mail.from)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      {/* Row 1: sender + time */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            !mail.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                          )}
                        >
                          {mail.from}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {mail.relativeTime}
                        </span>
                      </div>

                      {/* Row 2: subject */}
                      <p className="truncate text-xs font-medium text-foreground/70 mt-0.5">
                        {mail.subject}
                      </p>

                      {/* Row 3: preview */}
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {mail.preview}
                      </p>

                      {/* Row 4: labels */}
                      {mail.labels.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mail.labels.map((label) => (
                            <LabelBadge key={label} label={label} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                {idx < mails.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Mail View ─────────────────────────────────────────────────────────────────

interface MailViewProps {
  mail: MailItem | null
  replyText: string
  onReplyChange: (v: string) => void
  onSendReply: () => void
}

interface ToolbarAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function MailView({ mail, replyText, onReplyChange, onSendReply }: MailViewProps) {
  if (!mail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <MailIcon className="size-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No message selected
        </p>
        <p className="text-xs text-muted-foreground/60">
          Choose a message from the list to read it here.
        </p>
      </div>
    )
  }

  const leftActions: ToolbarAction[] = [
    { icon: <Archive className="size-4" />, label: "Archive", onClick: () => {} },
    { icon: <AlertOctagon className="size-4" />, label: "Move to junk", onClick: () => {} },
    { icon: <Trash2 className="size-4" />, label: "Move to trash", onClick: () => {} },
    { icon: <Clock className="size-4" />, label: "Snooze", onClick: () => {} },
  ]

  const rightActions: ToolbarAction[] = [
    { icon: <Reply className="size-4" />, label: "Reply", onClick: () => {} },
    { icon: <ReplyAll className="size-4" />, label: "Reply all", onClick: () => {} },
    { icon: <Forward className="size-4" />, label: "Forward", onClick: () => {} },
    { icon: <MoreHorizontal className="size-4" />, label: "More options", onClick: () => {} },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {leftActions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={action.onClick}
                      aria-label={action.label}
                    />
                  }
                >
                  {action.icon}
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {rightActions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={action.onClick}
                      aria-label={action.label}
                    />
                  }
                >
                  {action.icon}
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-5">
          {/* Sender header */}
          <div className="flex items-start gap-4">
            <Avatar className="shrink-0">
              <AvatarFallback className="bg-muted-foreground/15 text-foreground text-sm">
                {getInitials(mail.from)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{mail.from}</p>
                  <p className="text-xs text-muted-foreground">{mail.fromEmail}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDisplayDate(mail.date)}
                </p>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground/80">
                {mail.subject}
              </p>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Message body */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {mail.body}
          </div>
        </div>
      </ScrollArea>

      {/* Reply box */}
      <div className="border-t border-border px-4 py-3">
        <div className="rounded-lg border border-input bg-background p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Reply to {mail.from}
          </p>
          <Textarea
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            className="min-h-[80px] resize-none border-none bg-transparent px-0 py-0 text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:border-none"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={onSendReply} disabled={!replyText.trim()}>
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Mail App ─────────────────────────────────────────────────────────────

export function MailApp() {
  const [mails, setMails] = useState<MailItem[]>(INITIAL_MAILS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"all" | "unread">("all")
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox")
  const [replyText, setReplyText] = useState("")

  const folderLabel =
    FOLDERS.find((f) => f.id === activeFolder)?.label ?? "Inbox"

  const filteredMails = useMemo(() => {
    let list = mails.filter((m) => m.folder === activeFolder)

    if (tab === "unread") {
      list = list.filter((m) => !m.read)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.from.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q)
      )
    }

    return list
  }, [mails, activeFolder, tab, search])

  const selectedMail = useMemo(
    () => mails.find((m) => m.id === selectedId) ?? null,
    [mails, selectedId]
  )

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setReplyText("")
    // Mark as read
    setMails((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    )
  }, [])

  const handleFolderChange = useCallback((folder: MailFolder) => {
    setActiveFolder(folder)
    setSelectedId(null)
    setSearch("")
    setTab("all")
  }, [])

  const handleCompose = useCallback(() => {
    setSelectedId(null)
    setReplyText("")
  }, [])

  const handleSendReply = useCallback(() => {
    setReplyText("")
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border bg-background">
      {/* Left Sidebar */}
      <div className="hidden w-52 shrink-0 border-r border-border md:block">
        <ScrollArea className="h-full">
          <MailSidebar
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            onCompose={handleCompose}
          />
        </ScrollArea>
      </div>

      {/* Center Mail List */}
      <div className="w-full border-r border-border md:w-80 md:shrink-0">
        <MailList
          mails={filteredMails}
          selectedId={selectedId}
          search={search}
          tab={tab}
          folderLabel={folderLabel}
          onSearchChange={setSearch}
          onTabChange={setTab}
          onSelect={handleSelect}
        />
      </div>

      {/* Right Reading Pane */}
      <div className="hidden flex-1 md:block">
        <MailView
          mail={selectedMail}
          replyText={replyText}
          onReplyChange={setReplyText}
          onSendReply={handleSendReply}
        />
      </div>
    </div>
  )
}
