"use client"

import * as React from "react"
import { CalendarIcon, Clock } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Fixed "today" for deterministic rendering — NEVER use new Date() or Date.now()
const FIXED_TODAY = new Date(2026, 5, 8) // June 8 2026
const FIXED_DEFAULT_MONTH = new Date(2026, 5, 1)

// ─── 1. Single ───────────────────────────────────────────────────────────────
export function SingleVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
    />
  )
}

// ─── 2. Range ────────────────────────────────────────────────────────────────
export function RangeVariant() {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2026, 5, 10),
    to: new Date(2026, 5, 16),
  })
  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={setRange}
      defaultMonth={FIXED_DEFAULT_MONTH}
    />
  )
}

// ─── 3. Multiple ─────────────────────────────────────────────────────────────
export function MultipleVariant() {
  const [selected, setSelected] = React.useState<Date[] | undefined>([
    new Date(2026, 5, 5),
    new Date(2026, 5, 12),
    new Date(2026, 5, 19),
    new Date(2026, 5, 26),
  ])
  return (
    <Calendar
      mode="multiple"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
    />
  )
}

// ─── 4. Dual Month ───────────────────────────────────────────────────────────
export function DualMonthVariant() {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2026, 5, 10),
    to: new Date(2026, 5, 25),
  })
  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      selected={range}
      onSelect={setRange}
      defaultMonth={FIXED_DEFAULT_MONTH}
    />
  )
}

// ─── 5. Month/Year Dropdown ──────────────────────────────────────────────────
export function DropdownVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
      startMonth={new Date(2020, 0)}
      endMonth={new Date(2030, 11)}
    />
  )
}

// ─── 6. With Today Button ────────────────────────────────────────────────────
export function WithTodayButtonVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        defaultMonth={FIXED_DEFAULT_MONTH}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSelected(FIXED_TODAY)}
      >
        Today
      </Button>
    </div>
  )
}

// ─── 7. With Time Picker ─────────────────────────────────────────────────────
export function WithTimePickerVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        defaultMonth={FIXED_DEFAULT_MONTH}
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4" />
        <Input
          type="time"
          defaultValue="10:30"
          className="w-28 h-8 text-sm"
          aria-label="Enter time"
        />
      </div>
    </div>
  )
}

// ─── 8. Preset Ranges ────────────────────────────────────────────────────────
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const PRESETS: { label: string; range: () => DateRange }[] = [
  {
    label: "Today",
    range: () => ({ from: FIXED_TODAY, to: FIXED_TODAY }),
  },
  {
    label: "Yesterday",
    range: () => {
      const d = new Date(2026, 5, 7)
      return { from: d, to: d }
    },
  },
  {
    label: "Last 7 days",
    range: () => ({ from: new Date(2026, 5, 1), to: FIXED_TODAY }),
  },
  {
    label: "Last 30 days",
    range: () => ({ from: new Date(2026, 4, 9), to: FIXED_TODAY }),
  },
  {
    label: "Month to date",
    range: () => ({ from: new Date(2026, 5, 1), to: FIXED_TODAY }),
  },
  {
    label: "Last month",
    range: () => ({ from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) }),
  },
  {
    label: "Year to date",
    range: () => ({ from: new Date(2026, 0, 1), to: FIXED_TODAY }),
  },
  {
    label: "Last year",
    range: () => ({ from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) }),
  },
]

export function PresetRangesVariant() {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: FIXED_TODAY,
    to: FIXED_TODAY,
  })
  const [activePreset, setActivePreset] = React.useState<string>("Today")

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex flex-col gap-1 min-w-[130px]">
        {PRESETS.map(({ label, range: getRange }) => (
          <Button
            key={label}
            variant={activePreset === label ? "default" : "ghost"}
            size="sm"
            className="justify-start text-xs h-7"
            onClick={() => {
              setRange(getRange())
              setActivePreset(label)
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Calendar
        mode="range"
        selected={range}
        onSelect={(r) => {
          setRange(r)
          setActivePreset("")
        }}
        defaultMonth={FIXED_DEFAULT_MONTH}
      />
    </div>
  )
}

// ─── 9. Time Slots ───────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
]

export function TimeSlotsVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  const [slot, setSlot] = React.useState<string | undefined>("10:00")

  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        defaultMonth={FIXED_DEFAULT_MONTH}
      />
      <div className="grid grid-cols-3 gap-1 w-full max-w-[210px]">
        {TIME_SLOTS.map((t) => (
          <Button
            key={t}
            variant={slot === t ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-1"
            onClick={() => setSlot(t)}
          >
            {t}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ─── 10. Disabled Dates ──────────────────────────────────────────────────────
export function DisabledDatesVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
      disabled={{ dayOfWeek: [0, 6] }}
    />
  )
}

// ─── 11. Date of Birth ───────────────────────────────────────────────────────
export function DateOfBirthVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(1995, 2, 22)
  )
  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={new Date(1995, 2, 1)}
      startMonth={new Date(1950, 0)}
      endMonth={new Date(2026, 11)}
    />
  )
}

// ─── 12. Events / Booked ─────────────────────────────────────────────────────
export function EventsVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
      modifiers={{
        booked: [new Date(2026, 5, 12), new Date(2026, 5, 20), new Date(2026, 5, 25)],
      }}
      modifiersClassNames={{
        booked: "bg-primary/15 text-primary font-semibold rounded-md",
      }}
    />
  )
}

// ─── 13. With Footer ─────────────────────────────────────────────────────────
export function WithFooterVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(undefined)

  const footerText = selected
    ? `Selected: ${selected.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`
    : "Pick a day"

  return (
    <div data-testid="cal-footer">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        defaultMonth={FIXED_DEFAULT_MONTH}
        footer={
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {footerText}
          </p>
        }
      />
    </div>
  )
}

// ─── 14. In a Popover ────────────────────────────────────────────────────────
export function InPopoverVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )

  const label = selected
    ? selected.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date"

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "w-52 justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 size-4" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          defaultMonth={FIXED_DEFAULT_MONTH}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── 15. Week Numbers ────────────────────────────────────────────────────────
export function WeekNumbersVariant() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 5, 15)
  )
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={FIXED_DEFAULT_MONTH}
      showWeekNumber
      fixedWeeks
    />
  )
}
