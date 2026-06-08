"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  Search,
  SquarePen,
  Paperclip,
  Send,
  Phone,
  Video,
  MoreHorizontal,
  MessageSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { INITIAL_CONVERSATIONS, type Conversation, type Message } from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgCounter = 0
function newMsgId(): string {
  _msgCounter += 1
  return `msg-new-${_msgCounter}`
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  conversation: Conversation
  selected: boolean
  onClick: () => void
}

function ConversationRow({ conversation, selected, onClick }: ConversationRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
        selected && "bg-muted"
      )}
    >
      {/* Avatar with online indicator */}
      <div className="relative shrink-0">
        <Avatar>
          <AvatarFallback className="bg-muted-foreground/15 text-foreground text-xs font-semibold">
            {conversation.initials}
          </AvatarFallback>
        </Avatar>
        {conversation.online && (
          <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {conversation.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {conversation.timestamp}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground leading-snug">
            {conversation.lastMessage}
          </p>
          {conversation.unread > 0 && (
            <Badge className="shrink-0 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
              {conversation.unread}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Conversation List Panel ──────────────────────────────────────────────────

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  search: string
  onSearchChange: (v: string) => void
  onSelect: (id: string) => void
}

function ConversationList({
  conversations,
  selectedId,
  search,
  onSearchChange,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold tracking-tight">Chats</h2>
        <Button variant="ghost" size="icon-sm" aria-label="New chat">
          <SquarePen className="size-4" />
        </Button>
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

      {/* List */}
      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/50">
            {conversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                selected={selectedId === conv.id}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isMe = message.sender === "me"
  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isMe
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        <p>{message.text}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {message.time}
        </p>
      </div>
    </div>
  )
}

// ─── Thread Panel ─────────────────────────────────────────────────────────────

interface ThreadPanelProps {
  conversation: Conversation | null
  messages: Message[]
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
}

function ThreadPanel({
  conversation,
  messages,
  inputValue,
  onInputChange,
  onSend,
}: ThreadPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <MessageSquare className="size-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          Select a conversation
        </p>
        <p className="text-xs text-muted-foreground/60">
          Choose a contact to start chatting.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative shrink-0">
          <Avatar>
            <AvatarFallback className="bg-muted-foreground/15 text-foreground text-xs font-semibold">
              {conversation.initials}
            </AvatarFallback>
          </Avatar>
          {conversation.online && (
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{conversation.name}</p>
          <p className="text-xs text-muted-foreground leading-tight">
            {conversation.online ? "Online" : conversation.lastSeen}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Voice call">
            <Phone className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Video call">
            <Video className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More options" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View profile</DropdownMenuItem>
              <DropdownMenuItem>Mute notifications</DropdownMenuItem>
              <DropdownMenuItem>Block contact</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Delete conversation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Input footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Attach file">
            <Paperclip className="size-4" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && inputValue.trim()) {
                e.preventDefault()
                onSend()
              }
            }}
            className="flex-1 h-8 text-sm"
          />
          <Button
            size="icon-sm"
            disabled={!inputValue.trim()}
            onClick={onSend}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chats App ───────────────────────────────────────────────────────────

export function ChatsApp() {
  const [conversations, setConversations] = useState<Conversation[]>(
    INITIAL_CONVERSATIONS
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [messageInput, setMessageInput] = useState("")

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const currentMessages = selectedConversation?.messages ?? []

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setMessageInput("")
    // Clear unread badge
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    )
  }, [])

  const handleSend = useCallback(() => {
    if (!selectedId || !messageInput.trim()) return
    const text = messageInput.trim()

    // Fixed time — no argless new Date()
    const now = new Date(2026, 5, 7, 10, 0, 0)
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    const newMsg: Message = {
      id: newMsgId(),
      text,
      sender: "me",
      time: timeStr,
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: text,
              timestamp: "Just now",
            }
          : c
      )
    )
    setMessageInput("")
  }, [selectedId, messageInput])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border bg-background">
      {/* Left: conversation list */}
      <div className="w-80 shrink-0 border-r border-border">
        <ConversationList
          conversations={filteredConversations}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
        />
      </div>

      {/* Right: thread */}
      <div className="flex-1 min-w-0">
        <ThreadPanel
          conversation={selectedConversation}
          messages={currentMessages}
          inputValue={messageInput}
          onInputChange={setMessageInput}
          onSend={handleSend}
        />
      </div>
    </div>
  )
}
