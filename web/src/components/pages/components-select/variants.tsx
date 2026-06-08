"use client"

import * as React from "react"
import { AlertCircle, Globe, Apple, Carrot, Circle, User, Search } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// ─── Shared fruit data ────────────────────────────────────────────────────────

// Base UI's SelectValue renders the selected item's VALUE (not its child text),
// so use value === label for these demo selects to display proper labels.
const FRUITS = [
  { value: "Apple", label: "Apple" },
  { value: "Banana", label: "Banana" },
  { value: "Blueberry", label: "Blueberry" },
  { value: "Grapes", label: "Grapes" },
  { value: "Pineapple", label: "Pineapple" },
]

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  const [value, setValue] = React.useState("")

  return (
    <div data-testid="select-default" className="flex flex-col gap-1.5">
      <Label htmlFor="select-default-trigger">Fruit</Label>
      <Select
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
      >
        <SelectTrigger id="select-default-trigger" className="w-[200px]">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── 2. With label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  const [value, setValue] = React.useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="select-label-trigger">Favorite fruit</Label>
      <Select
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
      >
        <SelectTrigger id="select-label-trigger" className="w-[200px]">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── 3. With icon ─────────────────────────────────────────────────────────────
export function WithIconVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {FRUITS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 4. With helper text ──────────────────────────────────────────────────────
export function WithHelperTextVariant() {
  const [value, setValue] = React.useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Choose your favorite fruit from the list.
      </p>
    </div>
  )
}

// ─── 5. Error state ───────────────────────────────────────────────────────────
export function ErrorStateVariant() {
  const [value, setValue] = React.useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
      >
        <SelectTrigger className="w-[200px]" aria-invalid>
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5 shrink-0" />
        Please select an option.
      </p>
    </div>
  )
}

// ─── 6. Option groups ─────────────────────────────────────────────────────────
export function OptionGroupsVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select an item" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="potato">Potato</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

// ─── 7. Status ────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: "Active", label: "Active", dotClass: "bg-green-500" },
  { value: "Away", label: "Away", dotClass: "bg-amber-500" },
  { value: "Busy", label: "Busy", dotClass: "bg-red-500" },
  { value: "Offline", label: "Offline", dotClass: "bg-gray-400" },
]

export function StatusVariant() {
  const [value, setValue] = React.useState("")
  const selected = STATUSES.find((s) => s.value === value)

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a status">
          {selected && (
            <span className="flex items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", selected.dotClass)} />
              {selected.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <span className={cn("size-2 shrink-0 rounded-full", s.dotClass)} />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 8. Items with icons ──────────────────────────────────────────────────────
const ICON_FRUITS = [
  { value: "Apple", label: "Apple", icon: Apple },
  { value: "Banana", label: "Banana", icon: Circle },
  { value: "Blueberry", label: "Blueberry", icon: Circle },
  { value: "Grapes", label: "Grapes", icon: Circle },
  { value: "Carrot", label: "Carrot", icon: Carrot },
]

export function ItemsWithIconsVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {ICON_FRUITS.map((f) => {
          const Icon = f.icon
          return (
            <SelectItem key={f.value} value={f.value}>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              {f.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// ─── 9. Items with description ────────────────────────────────────────────────
const DESCRIBED_FRUITS = [
  { value: "Apple", label: "Apple", description: "Crisp and sweet red fruit." },
  { value: "Banana", label: "Banana", description: "Soft tropical yellow fruit." },
  { value: "Blueberry", label: "Blueberry", description: "Small antioxidant-rich berry." },
  { value: "Grapes", label: "Grapes", description: "Juicy vine-grown clusters." },
  { value: "Pineapple", label: "Pineapple", description: "Tangy tropical fruit." },
]

export function ItemsWithDescriptionVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent className="w-[280px]">
        {DESCRIBED_FRUITS.map((f) => (
          <SelectItem key={f.value} value={f.value} className="items-start py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 10. With avatar ──────────────────────────────────────────────────────────
const ASSIGNEES = [
  { value: "Alice Park", label: "Alice Park", initials: "AP" },
  { value: "Bob Kim", label: "Bob Kim", initials: "BK" },
  { value: "Carol Lee", label: "Carol Lee", initials: "CL" },
  { value: "David Wu", label: "David Wu", initials: "DW" },
  { value: "Eve Chen", label: "Eve Chen", initials: "EC" },
]

export function WithAvatarVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <User className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Assign to…" />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNEES.map((a) => (
          <SelectItem key={a.value} value={a.value}>
            <Avatar size="sm">
              <AvatarFallback>{a.initials}</AvatarFallback>
            </Avatar>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 11. Scrollable ───────────────────────────────────────────────────────────
const TIMEZONES = [
  { value: "UTC−12:00 Baker Island", label: "UTC−12:00 Baker Island" },
  { value: "UTC−11:00 American Samoa", label: "UTC−11:00 American Samoa" },
  { value: "UTC−10:00 Hawaii", label: "UTC−10:00 Hawaii" },
  { value: "UTC−09:00 Alaska", label: "UTC−09:00 Alaska" },
  { value: "UTC−08:00 Pacific Time", label: "UTC−08:00 Pacific Time" },
  { value: "UTC−07:00 Mountain Time", label: "UTC−07:00 Mountain Time" },
  { value: "UTC−06:00 Central Time", label: "UTC−06:00 Central Time" },
  { value: "UTC−05:00 Eastern Time", label: "UTC−05:00 Eastern Time" },
  { value: "UTC−04:00 Atlantic Time", label: "UTC−04:00 Atlantic Time" },
  { value: "UTC−03:00 Buenos Aires", label: "UTC−03:00 Buenos Aires" },
  { value: "UTC−02:00 Mid-Atlantic", label: "UTC−02:00 Mid-Atlantic" },
  { value: "UTC−01:00 Azores", label: "UTC−01:00 Azores" },
  { value: "UTC+00:00 London", label: "UTC+00:00 London" },
  { value: "UTC+01:00 Berlin", label: "UTC+01:00 Berlin" },
  { value: "UTC+02:00 Cairo", label: "UTC+02:00 Cairo" },
  { value: "UTC+03:00 Moscow", label: "UTC+03:00 Moscow" },
  { value: "UTC+04:00 Dubai", label: "UTC+04:00 Dubai" },
  { value: "UTC+05:00 Karachi", label: "UTC+05:00 Karachi" },
  { value: "UTC+05:30 Mumbai", label: "UTC+05:30 Mumbai" },
  { value: "UTC+06:00 Dhaka", label: "UTC+06:00 Dhaka" },
]

export function ScrollableVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 12. With search ─────────────────────────────────────────────────────────
export function WithSearchVariant() {
  const [value, setValue] = React.useState("")
  const [query, setQuery] = React.useState("")

  const filtered = FRUITS.filter((f) =>
    f.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 bg-popover p-1 pb-0">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
              className="h-7 pl-6 text-xs"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No results.</div>
        ) : (
          filtered.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

// ─── 13. Disabled select ──────────────────────────────────────────────────────
export function DisabledSelectVariant() {
  return (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {FRUITS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── 14. Disabled options ─────────────────────────────────────────────────────
export function DisabledOptionsVariant() {
  const [value, setValue] = React.useState("")

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana" disabled>Banana</SelectItem>
        <SelectItem value="blueberry">Blueberry</SelectItem>
        <SelectItem value="grapes" disabled>Grapes</SelectItem>
        <SelectItem value="pineapple">Pineapple</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ─── 15. Sizes ────────────────────────────────────────────────────────────────
export function SizesVariant() {
  const [valueSm, setValueSm] = React.useState("")
  const [valueDef, setValueDef] = React.useState("")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Small</span>
        <Select
          value={valueSm}
          onValueChange={(v) => { if (v != null) setValueSm(v) }}
        >
          <SelectTrigger size="sm" className="w-[200px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            {FRUITS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Default</span>
        <Select
          value={valueDef}
          onValueChange={(v) => { if (v != null) setValueDef(v) }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            {FRUITS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
