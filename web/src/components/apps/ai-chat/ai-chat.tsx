"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Plus,
  Sparkles,
  Bot,
  User,
  Paperclip,
  Settings,
  MessageSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import {
  SEEDED_CONVERSATIONS,
  SUGGESTED_PROMPTS,
  AI_MODELS,
  getMockReply,
  type Message,
  type Conversation,
} from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function newId(prefix: string): string {
  _idCounter += 1
  return `${prefix}-${_idCounter}`
}

// ─── Sidebar: History Row ─────────────────────────────────────────────────────

interface HistoryRowProps {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

function HistoryRow({ conversation, active, onClick }: HistoryRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
        active && "bg-muted"
      )}
    >
      <span className="truncate w-full font-medium text-foreground leading-snug">
        {conversation.title}
      </span>
      <span className="truncate w-full text-xs text-muted-foreground">
        {conversation.timestamp}
      </span>
    </button>
  )
}

// ─── Chat Sidebar ─────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
}

function ChatSidebar({ conversations, activeId, onSelect, onNewChat }: ChatSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-2 pt-4">
      {/* New Chat button */}
      <div className="px-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      {/* History label */}
      <p className="px-3 pt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Recent
      </p>

      {/* History list */}
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5 pb-4">
          {conversations.map((conv) => (
            <HistoryRow
              key={conv.id}
              conversation={conv}
              active={activeId === conv.id}
              onClick={() => onSelect(conv.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Welcome State ────────────────────────────────────────────────────────────

interface WelcomeStateProps {
  onPromptClick: (text: string) => void
}

function WelcomeState({ onPromptClick }: WelcomeStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      {/* Icon + heading */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Sparkles className="size-8 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            How can I help you today?
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ask me anything — from coding questions to creative writing, I&apos;m here to help.
          </p>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 w-full max-w-xl">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onPromptClick(prompt.text)}
            className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/60 hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-sm font-medium text-foreground">{prompt.text}</span>
            <span className="text-xs text-muted-foreground">{prompt.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* AI avatar — left side */}
      {!isUser && (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isUser ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {message.timestamp}
        </p>
      </div>

      {/* User avatar — right side */}
      {isUser && (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarFallback className="bg-muted-foreground/15 text-foreground">
            <User className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ─── Thread Area ──────────────────────────────────────────────────────────────

interface ThreadAreaProps {
  messages: Message[]
  isTyping: boolean
  onPromptClick: (text: string) => void
}

function ThreadArea({ messages, isTyping, onPromptClick }: ThreadAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  if (messages.length === 0) {
    return <WelcomeState onPromptClick={onPromptClick} />
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>
    </div>
  )
}

// ─── Input Footer ─────────────────────────────────────────────────────────────

interface InputFooterProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}

function InputFooter({ value, onChange, onSend, disabled }: InputFooterProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) onSend()
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mb-0.5 shrink-0 text-muted-foreground"
            aria-label="Attach file"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            placeholder="Message AI…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[2.25rem] max-h-40 flex-1 resize-none border-0 bg-transparent p-0 text-sm outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent field-sizing-content"
            rows={1}
          />
          <Button
            size="icon-sm"
            className="mb-0.5 shrink-0"
            disabled={!value.trim() || disabled}
            onClick={onSend}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  )
}

// ─── Main AI Chat App ─────────────────────────────────────────────────────────

export function AiChat() {
  const [conversations, setConversations] = useState<Conversation[]>(SEEDED_CONVERSATIONS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [model, setModel] = useState<string>("gpt-4o")

  // When user selects a history item, load its messages
  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    setActiveId(id)
    setMessages(conv.messages)
    setInput("")
    setIsTyping(false)
  }, [conversations])

  const handleNewChat = useCallback(() => {
    setActiveId(null)
    setMessages([])
    setInput("")
    setIsTyping(false)
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isTyping) return

    // Build timestamp inside event handler — never at render/init time
    const now = new Date(2026, 5, 7)
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    const userMsg: Message = {
      id: newId("um"),
      role: "user",
      content: text,
      timestamp: timeStr,
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setIsTyping(true)

    // Simulated typing delay
    setTimeout(() => {
      const replyContent = getMockReply(text)
      const aiMsg: Message = {
        id: newId("am"),
        role: "assistant",
        content: replyContent,
        timestamp: timeStr,
      }
      const finalMessages = [...nextMessages, aiMsg]
      setMessages(finalMessages)
      setIsTyping(false)

      // Persist conversation — if it's a new chat, create it; otherwise update
      if (activeId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, messages: finalMessages } : c
          )
        )
      } else {
        const newConvId = newId("conv")
        const newConv: Conversation = {
          id: newConvId,
          title: text.slice(0, 40) + (text.length > 40 ? "…" : ""),
          preview: text,
          timestamp: "Just now",
          messages: finalMessages,
        }
        setConversations((prev) => [newConv, ...prev])
        setActiveId(newConvId)
      }
    }, 900)
  }, [input, isTyping, messages, activeId])

  const handlePromptClick = useCallback((text: string) => {
    setInput(text)
    // Immediately submit the suggested prompt
    const now = new Date(2026, 5, 7)
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    const userMsg: Message = {
      id: newId("um"),
      role: "user",
      content: text,
      timestamp: timeStr,
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const replyContent = getMockReply(text)
      const aiMsg: Message = {
        id: newId("am"),
        role: "assistant",
        content: replyContent,
        timestamp: timeStr,
      }
      const finalMessages = [...nextMessages, aiMsg]
      setMessages(finalMessages)
      setIsTyping(false)

      if (activeId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, messages: finalMessages } : c
          )
        )
      } else {
        const newConvId = newId("conv")
        const newConv: Conversation = {
          id: newConvId,
          title: text.slice(0, 40) + (text.length > 40 ? "…" : ""),
          preview: text,
          timestamp: "Just now",
          messages: finalMessages,
        }
        setConversations((prev) => [newConv, ...prev])
        setActiveId(newConvId)
      }
    }, 900)
  }, [messages, activeId])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border bg-background">
      {/* ── Left sidebar ── */}
      <div className="w-64 shrink-0 border-r border-border">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />
      </div>

      {/* ── Right: main chat area ── */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <Select
              value={model ?? undefined}
              onValueChange={(v) => { if (v != null) setModel(v) }}
            >
              <SelectTrigger size="sm" className="gap-1.5 font-medium text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-[10px]">
              Beta
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={handleNewChat}>
              <MessageSquare className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Settings" />
                }
              >
                <Settings className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Chat settings</DropdownMenuItem>
                <DropdownMenuItem>Manage memory</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Clear history</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Thread or welcome */}
        <ThreadArea
          messages={messages}
          isTyping={isTyping}
          onPromptClick={handlePromptClick}
        />

        {/* Input */}
        <InputFooter
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isTyping}
        />
      </div>
    </div>
  )
}
