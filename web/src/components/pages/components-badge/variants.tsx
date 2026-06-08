"use client"

import * as React from "react"
import {
  Check,
  ArrowRight,
  BadgeCheck,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge>New</Badge>
      <Badge>Default</Badge>
    </div>
  )
}

// ─── 2. Secondary ─────────────────────────────────────────────────────────────
export function SecondaryVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="secondary">Beta</Badge>
    </div>
  )
}

// ─── 3. Destructive ──────────────────────────────────────────────────────────
export function DestructiveVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge variant="destructive">Error</Badge>
      <Badge variant="destructive">Failed</Badge>
    </div>
  )
}

// ─── 4. Outline ───────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge variant="outline">Outline</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  )
}

// ─── 5. With leading icon ─────────────────────────────────────────────────────
export function WithLeadingIconVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="gap-1">
        <Check className="size-3" />
        Verified
      </Badge>
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="size-3" />
        Certified
      </Badge>
    </div>
  )
}

// ─── 6. With trailing icon ────────────────────────────────────────────────────
export function WithTrailingIconVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="gap-1">
        Upgrade
        <ArrowRight className="size-3" />
      </Badge>
      <Badge variant="outline" className="gap-1">
        View more
        <ArrowRight className="size-3" />
      </Badge>
    </div>
  )
}

// ─── 7. With dot ──────────────────────────────────────────────────────────────
export function WithDotVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge variant="outline" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Online
      </Badge>
      <Badge variant="outline" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Away
      </Badge>
      <Badge variant="outline" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
        Offline
      </Badge>
    </div>
  )
}

// ─── 8. Colored ───────────────────────────────────────────────────────────────
export function ColoredVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
        Success
      </Badge>
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
        Warning
      </Badge>
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
        Info
      </Badge>
    </div>
  )
}

// ─── 9. Number / count ────────────────────────────────────────────────────────
export function NumberCountVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="min-w-5 rounded-full px-1.5 tabular-nums">99+</Badge>
      <Badge variant="secondary" className="min-w-5 rounded-full px-1.5 tabular-nums">
        3
      </Badge>
      <Badge variant="outline" className="min-w-5 rounded-full px-1.5 tabular-nums">
        12
      </Badge>
    </div>
  )
}

// ─── 10. Removable ────────────────────────────────────────────────────────────
const INITIAL_TAGS = ["React", "Vue", "Svelte"]

export function RemovableVariant() {
  const [tags, setTags] = React.useState(INITIAL_TAGS)

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {tags.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">All removed</span>
      ) : (
        tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              aria-label="Remove"
              onClick={() => removeTag(tag)}
              className={cn(
                "ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full",
                "text-secondary-foreground/60 hover:text-secondary-foreground",
                "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              )}
            >
              <X className="size-2.5" />
            </button>
          </Badge>
        ))
      )}
    </div>
  )
}

// ─── 11. Soft / subtle ────────────────────────────────────────────────────────
export function SoftVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="bg-primary/10 text-primary border-0">Primary</Badge>
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
        Emerald
      </Badge>
      <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-0">
        Violet
      </Badge>
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0">
        Rose
      </Badge>
    </div>
  )
}

// ─── 12. Sizes ────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Badge className="h-4 rounded-4xl px-1.5 text-[10px]">Small</Badge>
      <Badge>Default</Badge>
      <Badge className="h-6 rounded-4xl px-3 py-1 text-sm">Large</Badge>
    </div>
  )
}
