"use client"

import * as React from "react"
import Link from "next/link"
import {
  AppWindowIcon,
  BellIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleDotIcon,
  CircleUserIcon,
  CommandIcon,
  EllipsisIcon,
  FileTextIcon,
  FormInputIcon,
  GalleryHorizontalIcon,
  GroupIcon,
  InboxIcon,
  LayoutPanelTopIcon,
  ListFilterIcon,
  ListIcon,
  LoaderCircleIcon,
  MenuIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  MinusIcon,
  MousePointer2Icon,
  MousePointerClickIcon,
  NavigationIcon,
  PanelBottomIcon,
  PanelRightIcon,
  ScrollTextIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  SquareMousePointerIcon,
  Table2Icon,
  TableIcon,
  TagIcon,
  TextCursorInputIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CATEGORIES, COMPONENTS, type ComponentCategory, type ComponentEntry } from "@/components/pages/components-catalog/data"

// ── Icon map ───────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  AppWindow:              AppWindowIcon,
  Bell:                   BellIcon,
  Calendar:               CalendarIcon,
  CheckSquare:            CheckSquareIcon,
  ChevronDown:            ChevronDownIcon,
  ChevronRight:           ChevronRightIcon,
  ChevronsUpDown:         ChevronsUpDownIcon,
  CircleDot:              CircleDotIcon,
  CircleUser:             CircleUserIcon,
  Command:                CommandIcon,
  Ellipsis:               EllipsisIcon,
  FileText:               FileTextIcon,
  FormInput:              FormInputIcon,
  GalleryHorizontal:      GalleryHorizontalIcon,
  Group:                  GroupIcon,
  Inbox:                  InboxIcon,
  LayoutPanelTop:         LayoutPanelTopIcon,
  List:                   ListIcon,
  ListFilter:             ListFilterIcon,
  Loader:                 LoaderCircleIcon,
  LoaderCircle:           LoaderCircleIcon,
  Menu:                   MenuIcon,
  MessageCircle:          MessageCircleIcon,
  MessageSquare:          MessageSquareIcon,
  MessageSquareWarning:   MessageSquareWarningIcon,
  Minus:                  MinusIcon,
  MousePointer2:          MousePointer2Icon,
  MousePointerClick:      MousePointerClickIcon,
  Navigation:             NavigationIcon,
  PanelBottom:            PanelBottomIcon,
  PanelRight:             PanelRightIcon,
  ScrollText:             ScrollTextIcon,
  SlidersHorizontal:      SlidersHorizontalIcon,
  Square:                 SquareIcon,
  SquareMousePointer:     SquareMousePointerIcon,
  Table:                  TableIcon,
  Table2:                 Table2Icon,
  Tag:                    TagIcon,
  TextCursorInput:        TextCursorInputIcon,
  ToggleLeft:             ToggleLeftIcon,
  ToggleRight:            ToggleRightIcon,
  TriangleAlert:          TriangleAlertIcon,
}

// ── Small, non-interactive live previews ──────────────────────────────────
function ButtonPreview() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm" variant="default">Default</Button>
      <Button size="sm" variant="outline">Outline</Button>
    </div>
  )
}

function BadgePreview() {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  )
}

function AvatarPreview() {
  return (
    <AvatarGroup>
      <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>CD</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>EF</AvatarFallback></Avatar>
    </AvatarGroup>
  )
}

function SwitchPreview() {
  const [on, setOn] = React.useState(true)
  return (
    <div className="flex items-center gap-2">
      <Switch checked={on} onCheckedChange={setOn} />
      <span className="text-xs text-muted-foreground">{on ? "On" : "Off"}</span>
    </div>
  )
}

function CheckboxPreview() {
  const [checked, setChecked] = React.useState(true)
  return (
    <div className="flex items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      <span className="text-xs text-muted-foreground">Accept terms</span>
    </div>
  )
}

function SliderPreview() {
  const [val, setVal] = React.useState([60])
  return (
    <div className="w-full max-w-[160px]">
      <Slider value={val} onValueChange={(v) => setVal(v as number[])} min={0} max={100} />
    </div>
  )
}

function ProgressPreview() {
  return (
    <div className="w-full max-w-[160px]">
      <Progress value={60}>
        <ProgressLabel>Progress</ProgressLabel>
        <ProgressValue>{(fmt: string | null) => fmt ?? "0%"}</ProgressValue>
      </Progress>
    </div>
  )
}

function InputPreview() {
  return (
    <Input placeholder="Type here…" className="h-7 max-w-[160px] text-xs" />
  )
}

function SkeletonPreview() {
  return (
    <div className="flex w-full max-w-[160px] flex-col gap-1.5">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

function TabsPreview() {
  return (
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b">Tab B</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function CardPreview() {
  return (
    <Card className="w-36 shadow-none">
      <CardHeader>
        <CardTitle className="text-xs">Mini Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Card content</p>
      </CardContent>
    </Card>
  )
}

function SeparatorPreview() {
  return (
    <div className="flex w-full max-w-[160px] flex-col gap-2">
      <span className="text-xs text-muted-foreground">Section A</span>
      <Separator />
      <span className="text-xs text-muted-foreground">Section B</span>
    </div>
  )
}

function SelectPreview() {
  const [val, setVal] = React.useState<string | null>(null)
  return (
    <Select value={val} onValueChange={(v) => setVal(v ?? null)}>
      <SelectTrigger className="h-7 max-w-[160px] text-xs">
        <SelectValue placeholder="Pick one…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="opt1">Option 1</SelectItem>
        <SelectItem value="opt2">Option 2</SelectItem>
      </SelectContent>
    </Select>
  )
}

function TooltipPreview() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button size="sm" variant="outline">Hover me</Button>} />
        <TooltipContent>This is a tooltip</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const LIVE_PREVIEWS: Record<string, React.FC> = {
  Button:    ButtonPreview,
  Badge:     BadgePreview,
  Avatar:    AvatarPreview,
  Switch:    SwitchPreview,
  Checkbox:  CheckboxPreview,
  Slider:    SliderPreview,
  Progress:  ProgressPreview,
  Input:     InputPreview,
  Skeleton:  SkeletonPreview,
  Tabs:      TabsPreview,
  Card:      CardPreview,
  Separator: SeparatorPreview,
  Select:    SelectPreview,
  Tooltip:   TooltipPreview,
}

// ── Component card ────────────────────────────────────────────────────────
function ComponentCard({ entry }: { entry: ComponentEntry }) {
  const LivePreview = LIVE_PREVIEWS[entry.name]
  const IconComp = ICON_MAP[entry.icon]

  const inner = (
    <>
      {/* Preview area */}
      <div className="flex h-32 items-center justify-center border-b border-border/60 bg-muted/30 px-4">
        {LivePreview ? (
          <LivePreview />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted ring-1 ring-foreground/8">
            {IconComp ? (
              <IconComp className="size-5 text-muted-foreground" />
            ) : (
              <SquareIcon className="size-5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Card footer info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-medium leading-tight">{entry.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.variants} variants</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {entry.category}
        </Badge>
      </div>
    </>
  )

  const cardClass = cn(
    "group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20"
  )

  if (entry.href) {
    return (
      <Link href={entry.href} className={cardClass}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={cardClass}>
      {inner}
    </div>
  )
}

// ── Category counts ───────────────────────────────────────────────────────
function getCategoryCounts(): Record<ComponentCategory, number> {
  const counts = {} as Record<ComponentCategory, number>
  counts["All"] = COMPONENTS.length
  for (const cat of CATEGORIES) {
    if (cat === "All") continue
    counts[cat] = COMPONENTS.filter((c) => c.category === cat).length
  }
  return counts
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ComponentsPage() {
  const [search, setSearch] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState<ComponentCategory>("All")

  const categoryCounts = React.useMemo(() => getCategoryCounts(), [])

  const filtered = React.useMemo(() => {
    return COMPONENTS.filter((entry) => {
      const matchesSearch = entry.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === "All" || entry.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

  return (
    <div className="flex flex-col gap-8 p-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          500+ Free Components for Shadcn UI
        </h1>
        <p className="text-sm text-muted-foreground">
          Explore our collection of 503 free shadcn components.
        </p>

        {/* Search */}
        <div className="relative mt-2 w-full max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components…"
            className="pl-8"
          />
        </div>

        {/* Category filter tabs */}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                {cat}
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-foreground"
                  )}
                >
                  {categoryCounts[cat]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <InboxIcon className="size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No components found</p>
          <p className="text-xs text-muted-foreground">
            Try a different search term or category.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <ComponentCard key={entry.name} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
