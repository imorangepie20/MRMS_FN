"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Plus,
  Sparkles,
  Bot,
  User,
  Paperclip,
  ChevronDown,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  SUGGESTED_PROMPTS,
  AI_MODELS,
  getMockReply,
  type Message,
} from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _v2Counter = 0
function newV2Id(prefix: string): string {
  _v2Counter += 1
  return `${prefix}-v2-${_v2Counter}`
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback
          className={
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary"
          }
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isUser
              ? "text-right text-primary-foreground/60"
              : "text-left text-muted-foreground"
          )}
        >
          {message.timestamp}
        </p>
      </div>
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ─── Welcome / Centered Hero ──────────────────────────────────────────────────

interface WelcomeHeroProps {
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onPromptClick: (text: string) => void
  isTyping: boolean
  model: string
  onModelChange: (v: string) => void
}

function WelcomeHero({
  input,
  onInputChange,
  onSend,
  onPromptClick,
  isTyping,
  model,
  onModelChange,
}: WelcomeHeroProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isTyping) onSend()
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      {/* Gradient accent orb */}
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl scale-150 opacity-60" />
          <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/80 to-primary ring-1 ring-primary/30 shadow-lg">
            <Sparkles className="size-10 text-primary-foreground" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            What can I help with?
          </h1>
          <p className="text-base text-muted-foreground max-w-md">
            Powered by{" "}
            <span className="font-medium text-foreground">
              {AI_MODELS.find((m) => m.value === model)?.label ?? model}
            </span>
            . Ask anything — no question is too big or too small.
          </p>
        </div>
      </div>

      {/* Prompt box */}
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border border-input bg-background shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all">
          <Textarea
            placeholder="Ask me anything…"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[3.5rem] max-h-48 resize-none rounded-2xl border-0 bg-transparent px-4 pt-4 pb-2 text-base outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent field-sizing-content"
            rows={2}
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-0">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Attach file"
              >
                <Paperclip className="size-4" />
              </Button>
              {/* Inline model selector */}
              <Select
                value={model ?? undefined}
                onValueChange={(v) => { if (v != null) onModelChange(v) }}
              >
                <SelectTrigger size="sm" className="h-7 gap-1 text-xs text-muted-foreground border-0 bg-transparent hover:bg-muted px-2">
                  <SelectValue />
                  <ChevronDown className="size-3 opacity-50" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!input.trim() || isTyping}
              onClick={onSend}
              className="gap-1.5 rounded-xl"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Suggested prompt chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onPromptClick(prompt.text)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Conversation View (after messages start) ─────────────────────────────────

interface ConversationViewProps {
  messages: Message[]
  isTyping: boolean
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
}

function ConversationView({
  messages,
  isTyping,
  input,
  onInputChange,
  onSend,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isTyping) onSend()
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Sticky bottom input */}
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
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[2.25rem] max-h-40 flex-1 resize-none border-0 bg-transparent p-0 text-sm outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent field-sizing-content"
              rows={1}
            />
            <Button
              size="icon-sm"
              className="mb-0.5 shrink-0"
              disabled={!input.trim() || isTyping}
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
    </div>
  )
}

// ─── Main AI Chat V2 App ──────────────────────────────────────────────────────

export function AiChatV2() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [model, setModel] = useState<string>("gpt-4o")

  const hasMessages = messages.length > 0

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isTyping) return

      const now = new Date(2026, 5, 7)
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })

      const userMsg: Message = {
        id: newV2Id("um"),
        role: "user",
        content: trimmed,
        timestamp: timeStr,
      }

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput("")
      setIsTyping(true)

      setTimeout(() => {
        const replyContent = getMockReply(trimmed)
        const aiMsg: Message = {
          id: newV2Id("am"),
          role: "assistant",
          content: replyContent,
          timestamp: timeStr,
        }
        setMessages([...nextMessages, aiMsg])
        setIsTyping(false)
      }, 900)
    },
    [messages, isTyping]
  )

  const handleSend = useCallback(() => {
    sendMessage(input)
  }, [input, sendMessage])

  const handlePromptClick = useCallback(
    (text: string) => {
      setInput(text)
      sendMessage(text)
    },
    [sendMessage]
  )

  const handleNewChat = useCallback(() => {
    setMessages([])
    setInput("")
    setIsTyping(false)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-xl border border-border bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">AI Chat</span>
          <Badge variant="outline" className="text-[10px]">
            V2
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector in top bar */}
          <Select
            value={model ?? undefined}
            onValueChange={(v) => { if (v != null) setModel(v) }}
          >
            <SelectTrigger size="sm" className="gap-1.5 text-xs">
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

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleNewChat}
          >
            <Plus className="size-3.5" />
            New chat
          </Button>
        </div>
      </div>

      {/* Main area */}
      {!hasMessages ? (
        <WelcomeHero
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onPromptClick={handlePromptClick}
          isTyping={isTyping}
          model={model}
          onModelChange={setModel}
        />
      ) : (
        <ConversationView
          messages={messages}
          isTyping={isTyping}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
        />
      )}
    </div>
  )
}
