import { Star, Plus, Minus, Bold, Italic, Underline } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── 1. Horizontal ────────────────────────────────────────────────────────────
export function HorizontalVariant() {
  return (
    <div className="w-full">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
        <p className="text-sm text-muted-foreground">
          An open-source UI component library.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4 text-sm">
        <span>Blog</span>
        <Separator orientation="vertical" />
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Source</span>
      </div>
    </div>
  )
}

// ─── 2. Vertical ──────────────────────────────────────────────────────────────
export function VerticalVariant() {
  return (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Profile</span>
      <Separator orientation="vertical" />
      <span>Settings</span>
      <Separator orientation="vertical" />
      <span>Help</span>
    </div>
  )
}

// ─── 3. With label (OR) ───────────────────────────────────────────────────────
export function WithLabelOrVariant() {
  return (
    <div className="flex w-full items-center gap-2">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground">OR</span>
      <Separator className="flex-1" />
    </div>
  )
}

// ─── 4. With text (left) ──────────────────────────────────────────────────────
export function WithTextLeftVariant() {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Section
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

// ─── 5. With icon ─────────────────────────────────────────────────────────────
export function WithIconVariant() {
  return (
    <div className="flex w-full items-center gap-2">
      <Separator className="flex-1" />
      <Star className="size-3.5 text-muted-foreground" />
      <Separator className="flex-1" />
    </div>
  )
}

// ─── 6. Dashed ────────────────────────────────────────────────────────────────
export function DashedVariant() {
  return (
    <div className="w-full border-t border-dashed border-border" />
  )
}

// ─── 7. Dotted ────────────────────────────────────────────────────────────────
export function DottedVariant() {
  return (
    <div className="w-full border-t border-dotted border-border" />
  )
}

// ─── 8. Gradient (horizontal) ─────────────────────────────────────────────────
export function GradientHorizontalVariant() {
  return (
    <div className="h-px w-full bg-linear-to-r from-transparent via-border to-transparent" />
  )
}

// ─── 9. Gradient (vertical) ───────────────────────────────────────────────────
export function GradientVerticalVariant() {
  return (
    <div className="flex h-16 items-center justify-center">
      <div className="w-px h-full bg-linear-to-b from-transparent via-border to-transparent" />
    </div>
  )
}

// ─── 10. Thick ────────────────────────────────────────────────────────────────
export function ThickVariant() {
  return (
    <div className="h-1 w-full rounded-full bg-border" />
  )
}

// ─── 11. Colored ──────────────────────────────────────────────────────────────
export function ColoredVariant() {
  return (
    <Separator className="bg-primary" />
  )
}

// ─── 12. Inset ────────────────────────────────────────────────────────────────
export function InsetVariant() {
  return (
    <div className="w-full space-y-2">
      <p className="text-sm text-muted-foreground px-4">Above the line</p>
      <Separator className="mx-6" />
      <p className="text-sm text-muted-foreground px-4">Below the line</p>
    </div>
  )
}

// ─── 13. In a list ────────────────────────────────────────────────────────────
export function InListVariant() {
  const items = ["Dashboard", "Analytics", "Settings"]
  return (
    <div className="w-full flex flex-col">
      {items.map((item, i) => (
        <div key={item}>
          <div className="py-2 text-sm px-1">{item}</div>
          {i < items.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  )
}

// ─── 14. Double line ──────────────────────────────────────────────────────────
export function DoubleLineVariant() {
  return (
    <div className="w-full flex flex-col gap-1">
      <Separator />
      <Separator />
    </div>
  )
}

// ─── 15. Vertical icon (toolbar) ─────────────────────────────────────────────
export function VerticalIconToolbarVariant() {
  return (
    <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-1.5">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Bold className="size-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Italic className="size-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Underline className="size-3.5" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Plus className="size-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Minus className="size-3.5" />
      </Button>
    </div>
  )
}

// ─── 16. Section divider ──────────────────────────────────────────────────────
export function SectionDividerVariant() {
  return (
    <div className="relative w-full flex items-center justify-center">
      <Separator className="absolute inset-x-0" />
      <Badge
        variant="outline"
        className={cn(
          "relative z-10 bg-background px-3 text-xs font-medium text-muted-foreground"
        )}
      >
        New Section
      </Badge>
    </div>
  )
}
