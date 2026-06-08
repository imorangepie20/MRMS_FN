"use client"

import * as React from "react"
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  ChevronDown,
  Copy,
  Scissors,
  Clipboard,
  DollarSign,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group"
import { cn } from "@/lib/utils"

// ─── 1. Basic ────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">Save</Button>
      <Button variant="outline">Exit</Button>
    </ButtonGroup>
  )
}

// ─── 2. Three Actions ────────────────────────────────────────────────────────
export function ThreeActionsVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">
        <Scissors />
        Cut
      </Button>
      <Button variant="outline">
        <Copy />
        Copy
      </Button>
      <Button variant="outline">
        <Clipboard />
        Paste
      </Button>
    </ButtonGroup>
  )
}

// ─── 3. Segmented (single) ───────────────────────────────────────────────────
export function SegmentedSingleVariant() {
  const [active, setActive] = React.useState<"Day" | "Week" | "Month">("Day")

  return (
    <ButtonGroup>
      {(["Day", "Week", "Month"] as const).map((label) => (
        <Button
          key={label}
          variant={active === label ? "default" : "outline"}
          aria-pressed={active === label}
          onClick={() => setActive(label)}
        >
          {label}
        </Button>
      ))}
    </ButtonGroup>
  )
}

// ─── 4. Segmented (multi) ────────────────────────────────────────────────────
export function SegmentedMultiVariant() {
  const [active, setActive] = React.useState<Set<string>>(new Set())

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const items = [
    { key: "bold", icon: <Bold className="size-4" />, label: "Bold" },
    { key: "italic", icon: <Italic className="size-4" />, label: "Italic" },
    { key: "underline", icon: <Underline className="size-4" />, label: "Underline" },
  ] as const

  return (
    <ButtonGroup>
      {items.map(({ key, icon, label }) => (
        <Button
          key={key}
          variant={active.has(key) ? "default" : "outline"}
          aria-pressed={active.has(key)}
          size="icon"
          aria-label={label}
          onClick={() => toggle(key)}
        >
          {icon}
        </Button>
      ))}
    </ButtonGroup>
  )
}

// ─── 5. Vertical ─────────────────────────────────────────────────────────────
export function VerticalVariant() {
  return (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  )
}

// ─── 6. Icon Only ────────────────────────────────────────────────────────────
export function IconOnlyVariant() {
  const [align, setAlign] = React.useState<"left" | "center" | "right">("left")

  return (
    <ButtonGroup>
      <Button
        variant={align === "left" ? "default" : "outline"}
        size="icon"
        aria-label="Align left"
        onClick={() => setAlign("left")}
      >
        <AlignLeft />
      </Button>
      <Button
        variant={align === "center" ? "default" : "outline"}
        size="icon"
        aria-label="Align center"
        onClick={() => setAlign("center")}
      >
        <AlignCenter />
      </Button>
      <Button
        variant={align === "right" ? "default" : "outline"}
        size="icon"
        aria-label="Align right"
        onClick={() => setAlign("right")}
      >
        <AlignRight />
      </Button>
    </ButtonGroup>
  )
}

// ─── 7. With Separator ───────────────────────────────────────────────────────
export function WithSeparatorVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">Cut</Button>
      <Button variant="outline">Copy</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">Paste</Button>
      <Button variant="outline">Undo</Button>
    </ButtonGroup>
  )
}

// ─── 8. Sizes ────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex flex-col items-center gap-3">
      <ButtonGroup>
        <Button variant="outline" size="sm">Small</Button>
        <Button variant="outline" size="sm">Group</Button>
        <Button variant="outline" size="sm">Buttons</Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="lg">Large</Button>
        <Button variant="outline" size="lg">Group</Button>
        <Button variant="outline" size="lg">Buttons</Button>
      </ButtonGroup>
    </div>
  )
}

// ─── 9. Outline ──────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">Archive</Button>
      <Button variant="outline">Share</Button>
      <Button variant="outline">Delete</Button>
    </ButtonGroup>
  )
}

// ─── 10. Numbered Pagination ─────────────────────────────────────────────────
export function NumberedPaginationVariant() {
  const [page, setPage] = React.useState(1)

  return (
    <ButtonGroup>
      {[1, 2, 3, 4, 5].map((n) => (
        <Button
          key={n}
          variant={page === n ? "default" : "outline"}
          aria-pressed={page === n}
          aria-label={`Page ${n}`}
          onClick={() => setPage(n)}
        >
          {n}
        </Button>
      ))}
    </ButtonGroup>
  )
}

// ─── 11. Split Dropdown ──────────────────────────────────────────────────────
export function SplitDropdownVariant() {
  return (
    <ButtonGroup>
      <Button>Save</Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="More options"
              className="px-1.5"
            />
          }
        >
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Save</DropdownMenuItem>
          <DropdownMenuItem>Save as…</DropdownMenuItem>
          <DropdownMenuItem>Export</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}

// ─── 12. Mixed ───────────────────────────────────────────────────────────────
export function MixedVariant() {
  return (
    <ButtonGroup>
      <Button>Primary</Button>
      <Button variant="outline">Secondary</Button>
      <Button variant="outline">Tertiary</Button>
    </ButtonGroup>
  )
}

// ─── 13. Attached Input + Button ─────────────────────────────────────────────
export function AttachedInputButtonVariant() {
  return (
    <ButtonGroup className="w-full max-w-xs">
      <Input
        type="email"
        placeholder="you@example.com"
        className="flex-1"
      />
      <Button>Subscribe</Button>
    </ButtonGroup>
  )
}

// ─── 14. Input with Prefix ───────────────────────────────────────────────────
export function InputWithPrefixVariant() {
  return (
    <ButtonGroup className="w-full max-w-xs">
      <ButtonGroupText>https://</ButtonGroupText>
      <Input placeholder="yoursite.com" className="flex-1" />
    </ButtonGroup>
  )
}

// ─── 15. Input + Select + Button ─────────────────────────────────────────────
export function InputSelectButtonVariant() {
  return (
    <ButtonGroup className="w-full max-w-sm">
      <Input
        type="number"
        placeholder="Amount"
        className="flex-1 min-w-0 w-24"
      />
      <Select defaultValue="usd">
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="usd">USD</SelectItem>
          <SelectItem value="eur">EUR</SelectItem>
          <SelectItem value="gbp">GBP</SelectItem>
        </SelectContent>
      </Select>
      <Button>Send</Button>
    </ButtonGroup>
  )
}

// ─── 16. Toolbar ─────────────────────────────────────────────────────────────
export function ToolbarVariant() {
  const [textStyle, setTextStyle] = React.useState<string | null>(null)
  const [textAlign, setTextAlign] = React.useState<string>("left")
  const [listType, setListType] = React.useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
      {/* Text style group */}
      <ButtonGroup>
        {[
          { key: "bold", icon: <Bold className="size-3.5" />, label: "Bold" },
          { key: "italic", icon: <Italic className="size-3.5" />, label: "Italic" },
          { key: "underline", icon: <Underline className="size-3.5" />, label: "Underline" },
        ].map(({ key, icon, label }) => (
          <Button
            key={key}
            size="icon-sm"
            variant={textStyle === key ? "default" : "outline"}
            aria-label={label}
            onClick={() => setTextStyle(textStyle === key ? null : key)}
          >
            {icon}
          </Button>
        ))}
      </ButtonGroup>

      <div className="mx-0.5 self-stretch w-px bg-border" />

      {/* Alignment group */}
      <ButtonGroup>
        {[
          { key: "left", icon: <AlignLeft className="size-3.5" />, label: "Align left" },
          { key: "center", icon: <AlignCenter className="size-3.5" />, label: "Align center" },
          { key: "right", icon: <AlignRight className="size-3.5" />, label: "Align right" },
        ].map(({ key, icon, label }) => (
          <Button
            key={key}
            size="icon-sm"
            variant={textAlign === key ? "default" : "outline"}
            aria-label={label}
            onClick={() => setTextAlign(key)}
          >
            {icon}
          </Button>
        ))}
      </ButtonGroup>

      <div className="mx-0.5 self-stretch w-px bg-border" />

      {/* List group */}
      <ButtonGroup>
        {[
          { key: "ul", icon: <List className="size-3.5" />, label: "Unordered list" },
          { key: "ol", icon: <ListOrdered className="size-3.5" />, label: "Ordered list" },
        ].map(({ key, icon, label }) => (
          <Button
            key={key}
            size="icon-sm"
            variant={listType === key ? "default" : "outline"}
            aria-label={label}
            onClick={() => setListType(listType === key ? null : key)}
          >
            {icon}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  )
}

// ─── 17. Pill / Rounded ──────────────────────────────────────────────────────
export function PillVariant() {
  const [active, setActive] = React.useState("all")

  return (
    <div className="inline-flex rounded-full border shadow-xs overflow-hidden">
      {[
        { key: "all", label: "All" },
        { key: "active", label: "Active" },
        { key: "inactive", label: "Inactive" },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActive(key)}
          aria-pressed={active === key}
          className={cn(
            "h-8 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
            active === key
              ? "bg-primary text-primary-foreground"
              : "bg-background text-foreground hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── 18. With Badge ──────────────────────────────────────────────────────────
export function WithBadgeVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">Inbox</Button>
      <Button variant="outline" className="gap-2">
        Notifications
        <Badge variant="secondary" className="rounded-full px-1.5 tabular-nums">
          12
        </Badge>
      </Button>
      <Button variant="outline">Archive</Button>
    </ButtonGroup>
  )
}

// ─── 19. Full Width ──────────────────────────────────────────────────────────
export function FullWidthVariant() {
  return (
    <ButtonGroup className="w-full">
      <Button variant="outline" className="flex-1">
        Cancel
      </Button>
      <Button className="flex-1">
        Confirm
      </Button>
    </ButtonGroup>
  )
}

// ─── 20. Nested ──────────────────────────────────────────────────────────────
export function NestedVariant() {
  return (
    <ButtonGroup>
      <Button variant="outline">Back</Button>
      {/* Nested sub-group for export options */}
      <ButtonGroup>
        <Button variant="outline">PDF</Button>
        <Button variant="outline">CSV</Button>
        <Button variant="outline">JSON</Button>
      </ButtonGroup>
      <Button variant="outline">Forward</Button>
    </ButtonGroup>
  )
}
