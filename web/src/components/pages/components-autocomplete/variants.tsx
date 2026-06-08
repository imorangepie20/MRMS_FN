"use client"

import * as React from "react"
import { CheckIcon, XIcon, ChevronsUpDownIcon, SearchIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

// ─── Shared data ──────────────────────────────────────────────────────────────
const FRAMEWORKS = [
  "Next.js",
  "React",
  "Vue",
  "Svelte",
  "Angular",
  "Remix",
  "Astro",
  "Solid",
  "Qwik",
  "Nuxt",
]

const GROUPED_FRAMEWORKS = {
  Frontend: ["React", "Vue", "Svelte", "Angular", "Solid"],
  "Meta-frameworks": ["Next.js", "Remix", "Astro", "Qwik", "Nuxt"],
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function DropdownContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md",
        className
      )}
    >
      {children}
    </div>
  )
}

function DropdownItem({
  children,
  active,
  selected,
  onMouseDown,
}: {
  children: React.ReactNode
  active?: boolean
  selected?: boolean
  onMouseDown: () => void
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown()
      }}
      className={cn(
        "flex cursor-default select-none items-center justify-between px-3 py-1.5 text-sm",
        active ? "bg-muted text-foreground" : "text-popover-foreground",
        "hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
      {selected && <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
      No results found.
    </div>
  )
}

// ─── 1. Basic ────────────────────────────────────────────────────────────────
export function BasicVariant() {
  const [inputValue, setInputValue] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const filtered = FRAMEWORKS.filter((f) =>
    f.toLowerCase().includes(inputValue.toLowerCase())
  )

  function handleSelect(value: string) {
    setSelected(value)
    setInputValue(value)
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setSelected(null)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative">
        <Input
          placeholder="Search framework…"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label="Search framework"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {open && (
          <DropdownContainer>
            <div role="listbox">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((f) => (
                  <DropdownItem
                    key={f}
                    selected={selected === f}
                    onMouseDown={() => handleSelect(f)}
                  >
                    {f}
                  </DropdownItem>
                ))
              )}
            </div>
          </DropdownContainer>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selected}</span>
        </p>
      )}
    </div>
  )
}

// ─── 2. With clear button ────────────────────────────────────────────────────
export function WithClearButtonVariant() {
  const [inputValue, setInputValue] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const filtered = FRAMEWORKS.filter((f) =>
    f.toLowerCase().includes(inputValue.toLowerCase())
  )

  function handleSelect(value: string) {
    setSelected(value)
    setInputValue(value)
    setOpen(false)
  }

  function handleClear() {
    setSelected(null)
    setInputValue("")
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setSelected(null)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="relative">
          <Input
            placeholder="Search framework…"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            className="pr-8"
            aria-label="Search framework with clear"
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
          />
          {(inputValue || selected) && (
            <button
              type="button"
              aria-label="Clear selection"
              onMouseDown={(e) => {
                e.preventDefault()
                handleClear()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {open && (
          <DropdownContainer>
            <div role="listbox">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((f) => (
                  <DropdownItem
                    key={f}
                    selected={selected === f}
                    onMouseDown={() => handleSelect(f)}
                  >
                    {f}
                  </DropdownItem>
                ))
              )}
            </div>
          </DropdownContainer>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selected}</span>
        </p>
      )}
    </div>
  )
}

// ─── 3. With groups and labels ───────────────────────────────────────────────
export function WithGroupsVariant() {
  const [inputValue, setInputValue] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const filteredGroups = Object.entries(GROUPED_FRAMEWORKS)
    .map(([label, items]) => ({
      label,
      items: items.filter((f) =>
        f.toLowerCase().includes(inputValue.toLowerCase())
      ),
    }))
    .filter(({ items }) => items.length > 0)

  const hasResults = filteredGroups.some(({ items }) => items.length > 0)

  function handleSelect(value: string) {
    setSelected(value)
    setInputValue(value)
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setSelected(null)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          placeholder="Search framework…"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label="Search grouped frameworks"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {open && (
          <DropdownContainer>
            <div role="listbox">
              {!hasResults ? (
                <EmptyState />
              ) : (
                filteredGroups.map(({ label, items }) => (
                  <div key={label} role="group" aria-label={label}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {label}
                    </div>
                    {items.map((f) => (
                      <DropdownItem
                        key={f}
                        selected={selected === f}
                        onMouseDown={() => handleSelect(f)}
                      >
                        {f}
                      </DropdownItem>
                    ))}
                    <div className="mx-1 my-1 h-px bg-border last:hidden" />
                  </div>
                ))
              )}
            </div>
          </DropdownContainer>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selected}</span>
        </p>
      )}
    </div>
  )
}

// ─── 4. Async items loading ───────────────────────────────────────────────────
export function AsyncLoadingVariant() {
  const [inputValue, setInputValue] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<string[]>([])
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    setSelected(null)
    setOpen(true)

    if (timerRef.current) clearTimeout(timerRef.current)

    if (!val) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setResults([])

    timerRef.current = setTimeout(() => {
      const filtered = FRAMEWORKS.filter((f) =>
        f.toLowerCase().includes(val.toLowerCase())
      )
      setResults(filtered)
      setLoading(false)
    }, 600)
  }

  function handleSelect(value: string) {
    setSelected(value)
    setInputValue(value)
    setOpen(false)
    setLoading(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showDropdown = open && inputValue.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          placeholder="Search framework…"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue) setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          aria-label="Search async frameworks"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          role="combobox"
        />
        {showDropdown && (
          <DropdownContainer>
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <div role="listbox">
                {results.length === 0 ? (
                  <EmptyState />
                ) : (
                  results.map((f) => (
                    <DropdownItem
                      key={f}
                      selected={selected === f}
                      onMouseDown={() => handleSelect(f)}
                    >
                      {f}
                    </DropdownItem>
                  ))
                )}
              </div>
            )}
          </DropdownContainer>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selected}</span>
        </p>
      )}
    </div>
  )
}

// ─── 5. Auto-highlight first option ──────────────────────────────────────────
export function AutoHighlightVariant() {
  const [inputValue, setInputValue] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const filtered = FRAMEWORKS.filter((f) =>
    f.toLowerCase().includes(inputValue.toLowerCase())
  )

  function handleSelect(value: string) {
    setSelected(value)
    setInputValue(value)
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
    setSelected(null)
    setActiveIndex(0)
    setOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = filtered[activeIndex]
      if (item) handleSelect(item)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          placeholder="Search framework…"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setActiveIndex(0)
            setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          aria-label="Search with auto-highlight"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `auto-highlight-option-${activeIndex}`
              : undefined
          }
        />
        {open && (
          <DropdownContainer>
            <div role="listbox">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((f, i) => (
                  <DropdownItem
                    key={f}
                    active={i === activeIndex}
                    selected={selected === f}
                    onMouseDown={() => handleSelect(f)}
                  >
                    {f}
                    {i === activeIndex && filtered.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        ↵
                      </span>
                    )}
                  </DropdownItem>
                ))
              )}
            </div>
          </DropdownContainer>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selected}</span>
        </p>
      )}
    </div>
  )
}
