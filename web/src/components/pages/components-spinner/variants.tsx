"use client"

import * as React from "react"
import { Send, Download, CreditCard } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <div className="flex items-center justify-center py-4">
      <Spinner className="size-6" />
    </div>
  )
}

// ─── 2. Sizes ─────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Spinner className="size-10" />
    </div>
  )
}

// ─── 3. With Label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Spinner className="size-4" />
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  )
}

// ─── 4. Colored ──────────────────────────────────────────────────────────────
export function ColoredVariant() {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Spinner className="size-6 text-primary" />
      <Spinner className="size-6 text-emerald-500" />
      <Spinner className="size-6 text-amber-500" />
      <Spinner className="size-6 text-rose-500" />
    </div>
  )
}

// ─── 5. In a Button ──────────────────────────────────────────────────────────
export function InButtonVariant() {
  return (
    <div className="flex items-center justify-center py-4">
      <Button disabled>
        <Spinner className="size-4" />
        Please wait
      </Button>
    </div>
  )
}

// ─── 6. Validating ───────────────────────────────────────────────────────────
export function ValidatingVariant() {
  const [validating, setValidating] = React.useState(false)

  function handleSend() {
    if (validating) return
    setValidating(true)
    const timer = setTimeout(() => setValidating(false), 1500)
    return () => clearTimeout(timer)
  }

  return (
    <div className="flex flex-col gap-3 py-4" data-testid="spinner-validate">
      <div className="flex gap-2">
        <Input placeholder="Enter value…" disabled={validating} />
        <Button onClick={handleSend} disabled={validating}>
          <Send className="size-4" />
          Send
        </Button>
      </div>
      {validating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Validating…
        </div>
      )}
    </div>
  )
}

// ─── 7. Dots ─────────────────────────────────────────────────────────────────
export function DotsVariant() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      <span
        className="size-2.5 rounded-full bg-primary animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="size-2.5 rounded-full bg-primary animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="size-2.5 rounded-full bg-primary animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}

// ─── 8. Bars ─────────────────────────────────────────────────────────────────
export function BarsVariant() {
  return (
    <div className="flex items-end justify-center gap-1 py-4 h-12">
      {[0, 150, 300, 150, 0].map((delay, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 rounded-sm bg-primary animate-pulse",
            i === 0 || i === 4 ? "h-3" : i === 1 || i === 3 ? "h-5" : "h-7"
          )}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

// ─── 9. Ring ─────────────────────────────────────────────────────────────────
export function RingVariant() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="size-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>
  )
}

// ─── 10. Pulse ───────────────────────────────────────────────────────────────
export function PulseVariant() {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="relative flex size-6">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
        <span className="relative inline-flex size-6 rounded-full bg-primary" />
      </span>
    </div>
  )
}

// ─── 11. Card Overlay ────────────────────────────────────────────────────────
export function CardOverlayVariant() {
  return (
    <div className="relative rounded-xl border bg-card p-6 flex flex-col gap-2 min-h-[100px] items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm rounded-xl">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm text-muted-foreground">Processing your request…</p>
      </div>
      <p className="text-sm text-muted-foreground opacity-30 select-none">Content underneath</p>
    </div>
  )
}

// ─── 12. Download Progress ───────────────────────────────────────────────────
export function DownloadProgressVariant() {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-2">
        <Download className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Downloading (35%)</span>
        <Spinner className="size-4 ml-auto" />
      </div>
      <Progress value={35} />
      <p className="text-xs text-muted-foreground">129 MB / 1000 MB</p>
    </div>
  )
}

// ─── 13. Payment Processing ──────────────────────────────────────────────────
export function PaymentProcessingVariant() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <CreditCard className="size-5 text-primary" />
      </div>
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-sm font-medium">Processing payment…</span>
      </div>
      <p className="text-lg font-bold">$100.00</p>
    </div>
  )
}

// ─── 14. Centered Block ──────────────────────────────────────────────────────
export function CenteredBlockVariant() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8">
      <Spinner className="size-6 text-primary" />
      <span className="text-sm text-muted-foreground">Syncing…</span>
    </div>
  )
}
