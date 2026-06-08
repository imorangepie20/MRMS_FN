"use client"

import * as React from "react"
import {
  Check,
  ChevronsUpDown,
  X,
  LoaderCircle,
  Plus,
  Circle,
  CircleDot,
  Timer,
  CheckCircle2,
  Code2,
  Layers,
  Zap,
  Wind,
  Star,
  Globe,
  Box,
  Layout,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ─── Shared data ──────────────────────────────────────────────────────────────

const FRAMEWORKS = [
  { value: "next.js", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt.js", label: "Nuxt.js" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
  { value: "gatsby", label: "Gatsby" },
  { value: "solid", label: "Solid" },
  { value: "qwik", label: "Qwik" },
]

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <div data-testid="combobox-basic">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[220px] justify-between"
            />
          }
        >
          {value
            ? FRAMEWORKS.find((f) => f.value === value)?.label
            : "Select framework…"}
          <ChevronsUpDown className="ml-auto opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0">
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {FRAMEWORKS.map((f) => (
                  <CommandItem
                    key={f.value}
                    value={f.value}
                    data-checked={value === f.value}
                    onSelect={(current) => {
                      setValue(current === value ? "" : current)
                      setOpen(false)
                    }}
                  >
                    {f.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === f.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── 2. Status ────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: "backlog", label: "Backlog", icon: Circle },
  { value: "todo", label: "Todo", icon: CircleDot },
  { value: "in-progress", label: "In Progress", icon: Timer },
  { value: "done", label: "Done", icon: CheckCircle2 },
  { value: "canceled", label: "Canceled", icon: X },
]

export function StatusVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const selected = STATUSES.find((s) => s.value === value)
  const Icon = selected?.icon

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 shrink-0" /> : null}
          {selected ? selected.label : "Select status…"}
        </span>
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {STATUSES.map((s) => {
                const SIcon = s.icon
                return (
                  <CommandItem
                    key={s.value}
                    value={s.value}
                    data-checked={value === s.value}
                    onSelect={(current) => {
                      setValue(current === value ? "" : current)
                      setOpen(false)
                    }}
                  >
                    <SIcon className="size-4 shrink-0" />
                    {s.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === s.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 3. Multi-select ──────────────────────────────────────────────────────────
export function MultiSelectVariant() {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const selectedArr = FRAMEWORKS.filter((f) => selected.has(f.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-hidden">
          {selectedArr.length === 0 ? (
            <span className="text-muted-foreground">Select frameworks…</span>
          ) : selectedArr.length <= 2 ? (
            selectedArr.map((f) => (
              <Badge key={f.value} variant="secondary" className="text-xs">
                {f.label}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-xs">
              {selectedArr.length} selected
            </Badge>
          )}
        </span>
        <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {FRAMEWORKS.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={selected.has(f.value)}
                  onSelect={(current) => toggle(current)}
                >
                  <Check
                    className={cn(
                      "mr-2",
                      selected.has(f.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {f.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 4. Grouped ───────────────────────────────────────────────────────────────
const GROUPED_FRAMEWORKS = [
  { value: "next.js", label: "Next.js", group: "Frameworks" },
  { value: "sveltekit", label: "SvelteKit", group: "Frameworks" },
  { value: "nuxt.js", label: "Nuxt.js", group: "Frameworks" },
  { value: "remix", label: "Remix", group: "Frameworks" },
  { value: "react", label: "React", group: "Libraries" },
  { value: "vue", label: "Vue", group: "Libraries" },
  { value: "svelte", label: "Svelte", group: "Libraries" },
  { value: "solid", label: "Solid", group: "Libraries" },
]

export function GroupedVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const frameworkItems = GROUPED_FRAMEWORKS.filter((f) => f.group === "Frameworks")
  const libraryItems = GROUPED_FRAMEWORKS.filter((f) => f.group === "Libraries")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        {value
          ? GROUPED_FRAMEWORKS.find((f) => f.value === value)?.label
          : "Select framework…"}
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Frameworks">
              {frameworkItems.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  {f.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Libraries">
              {libraryItems.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  {f.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 5. With icons ────────────────────────────────────────────────────────────
const ICON_FRAMEWORKS = [
  { value: "next.js", label: "Next.js", icon: Globe },
  { value: "sveltekit", label: "SvelteKit", icon: Zap },
  { value: "nuxt.js", label: "Nuxt.js", icon: Layers },
  { value: "remix", label: "Remix", icon: Code2 },
  { value: "astro", label: "Astro", icon: Star },
  { value: "gatsby", label: "Gatsby", icon: Wind },
  { value: "solid", label: "Solid", icon: Box },
  { value: "qwik", label: "Qwik", icon: Layout },
]

export function WithIconsVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const selected = ICON_FRAMEWORKS.find((f) => f.value === value)
  const SelectedIcon = selected?.icon

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        <span className="flex items-center gap-2">
          {SelectedIcon ? <SelectedIcon className="size-4 shrink-0" /> : null}
          {selected ? selected.label : "Select framework…"}
        </span>
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {ICON_FRAMEWORKS.map((f) => {
                const FIcon = f.icon
                return (
                  <CommandItem
                    key={f.value}
                    value={f.value}
                    data-checked={value === f.value}
                    onSelect={(current) => {
                      setValue(current === value ? "" : current)
                      setOpen(false)
                    }}
                  >
                    <FIcon className="size-4 shrink-0" />
                    {f.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === f.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 6. With descriptions ─────────────────────────────────────────────────────
const DESCRIBED_FRAMEWORKS = [
  { value: "next.js", label: "Next.js", description: "React framework with SSR & SSG." },
  { value: "sveltekit", label: "SvelteKit", description: "Full-stack Svelte framework." },
  { value: "nuxt.js", label: "Nuxt.js", description: "Intuitive Vue framework." },
  { value: "remix", label: "Remix", description: "Full-stack web framework." },
  { value: "astro", label: "Astro", description: "Content-focused web framework." },
  { value: "gatsby", label: "Gatsby", description: "React-based static site generator." },
]

export function WithDescriptionsVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        {value
          ? DESCRIBED_FRAMEWORKS.find((f) => f.value === value)?.label
          : "Select framework…"}
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {DESCRIBED_FRAMEWORKS.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                  className="items-start"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto mt-0.5 shrink-0",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 7. Disabled items ────────────────────────────────────────────────────────
const DISABLED_FRAMEWORKS = [
  { value: "next.js", label: "Next.js", disabled: false },
  { value: "sveltekit", label: "SvelteKit", disabled: true },
  { value: "nuxt.js", label: "Nuxt.js", disabled: false },
  { value: "remix", label: "Remix", disabled: true },
  { value: "astro", label: "Astro", disabled: false },
  { value: "gatsby", label: "Gatsby", disabled: false },
  { value: "solid", label: "Solid", disabled: true },
  { value: "qwik", label: "Qwik", disabled: false },
]

export function DisabledItemsVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        {value
          ? DISABLED_FRAMEWORKS.find((f) => f.value === value)?.label
          : "Select framework…"}
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {DISABLED_FRAMEWORKS.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  disabled={f.disabled}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  {f.label}
                  {f.disabled && (
                    <span className="ml-2 text-xs text-muted-foreground">(unavailable)</span>
                  )}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 8. Scrollable ────────────────────────────────────────────────────────────
const TIMEZONES = [
  { value: "utc-12", label: "UTC−12:00 Baker Island" },
  { value: "utc-11", label: "UTC−11:00 American Samoa" },
  { value: "utc-10", label: "UTC−10:00 Hawaii" },
  { value: "utc-9", label: "UTC−09:00 Alaska" },
  { value: "utc-8", label: "UTC−08:00 Pacific Time" },
  { value: "utc-7", label: "UTC−07:00 Mountain Time" },
  { value: "utc-6", label: "UTC−06:00 Central Time" },
  { value: "utc-5", label: "UTC−05:00 Eastern Time" },
  { value: "utc-4", label: "UTC−04:00 Atlantic Time" },
  { value: "utc-3", label: "UTC−03:00 Buenos Aires" },
  { value: "utc-2", label: "UTC−02:00 Mid-Atlantic" },
  { value: "utc-1", label: "UTC−01:00 Azores" },
  { value: "utc+0", label: "UTC+00:00 London" },
  { value: "utc+1", label: "UTC+01:00 Berlin" },
  { value: "utc+2", label: "UTC+02:00 Cairo" },
  { value: "utc+3", label: "UTC+03:00 Moscow" },
  { value: "utc+4", label: "UTC+04:00 Dubai" },
  { value: "utc+5", label: "UTC+05:00 Karachi" },
  { value: "utc+5.5", label: "UTC+05:30 Mumbai" },
  { value: "utc+6", label: "UTC+06:00 Dhaka" },
  { value: "utc+7", label: "UTC+07:00 Bangkok" },
  { value: "utc+8", label: "UTC+08:00 Singapore" },
  { value: "utc+9", label: "UTC+09:00 Tokyo" },
  { value: "utc+10", label: "UTC+10:00 Sydney" },
  { value: "utc+12", label: "UTC+12:00 Auckland" },
]

export function ScrollableVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        <span className="truncate">
          {value
            ? TIMEZONES.find((t) => t.value === value)?.label
            : "Select timezone…"}
        </span>
        <ChevronsUpDown className="ml-auto shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {TIMEZONES.map((t) => (
                <CommandItem
                  key={t.value}
                  value={t.value}
                  data-checked={value === t.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{t.label}</span>
                  <Check
                    className={cn(
                      "ml-auto shrink-0",
                      value === t.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 9. Loading ───────────────────────────────────────────────────────────────
export function LoadingVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<typeof FRAMEWORKS>([])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setLoading(true)
      setItems([])
      const id = setTimeout(() => {
        setItems(FRAMEWORKS)
        setLoading(false)
      }, 600)
      return () => clearTimeout(id)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        {value
          ? FRAMEWORKS.find((f) => f.value === value)?.label
          : "Select framework…"}
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup>
                  {items.map((f) => (
                    <CommandItem
                      key={f.value}
                      value={f.value}
                      data-checked={value === f.value}
                      onSelect={(current) => {
                        setValue(current === value ? "" : current)
                        setOpen(false)
                      }}
                    >
                      {f.label}
                      <Check
                        className={cn(
                          "ml-auto",
                          value === f.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 10. Clear button ─────────────────────────────────────────────────────────
export function ClearButtonVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const selected = FRAMEWORKS.find((f) => f.value === value)

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[180px] justify-between"
            />
          }
        >
          {selected ? selected.label : "Select framework…"}
          <ChevronsUpDown className="ml-auto opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0">
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {FRAMEWORKS.map((f) => (
                  <CommandItem
                    key={f.value}
                    value={f.value}
                    data-checked={value === f.value}
                    onSelect={(current) => {
                      setValue(current === value ? "" : current)
                      setOpen(false)
                    }}
                  >
                    {f.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === f.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          onClick={() => setValue("")}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

// ─── 11. Recent ───────────────────────────────────────────────────────────────
const RECENT_FRAMEWORKS = ["next.js", "remix"]

export function RecentVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const recentItems = FRAMEWORKS.filter((f) => RECENT_FRAMEWORKS.includes(f.value))
  const allItems = FRAMEWORKS.filter((f) => !RECENT_FRAMEWORKS.includes(f.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[220px] justify-between"
          />
        }
      >
        {value
          ? FRAMEWORKS.find((f) => f.value === value)?.label
          : "Select framework…"}
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Recent">
              {recentItems.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  {f.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="All">
              {allItems.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.value}
                  data-checked={value === f.value}
                  onSelect={(current) => {
                    setValue(current === value ? "" : current)
                    setOpen(false)
                  }}
                >
                  {f.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === f.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── 12. With button ─────────────────────────────────────────────────────────
export function WithButtonVariant() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [added, setAdded] = React.useState(false)

  function handleAdd() {
    if (value) {
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[170px] justify-between"
            />
          }
        >
          {value
            ? FRAMEWORKS.find((f) => f.value === value)?.label
            : "Assign framework…"}
          <ChevronsUpDown className="ml-auto opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0">
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {FRAMEWORKS.map((f) => (
                  <CommandItem
                    key={f.value}
                    value={f.value}
                    data-checked={value === f.value}
                    onSelect={(current) => {
                      setValue(current === value ? "" : current)
                      setOpen(false)
                    }}
                  >
                    {f.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === f.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button onClick={handleAdd} disabled={!value}>
        {added ? (
          <Check className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
        Add
      </Button>
    </div>
  )
}
