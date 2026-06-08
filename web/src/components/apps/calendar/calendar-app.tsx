"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  MY_CALENDARS,
  INITIAL_EVENTS,
  type CalendarEvent,
  type MyCalendar,
} from "@/components/apps/calendar/data";

// ─── Date helpers (deterministic — no argless new Date()) ───────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Fixed "today" = June 7, 2026
const TODAY = { y: 2026, m: 5, d: 7 };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface GridDay {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): GridDay[] {
  const firstDay = firstWeekdayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);

  const grid: GridDay[] = [];

  // Leading days from previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);
  for (let i = firstDay - 1; i >= 0; i--) {
    grid.push({ year: prevYear, month: prevMonth, day: prevMonthDays - i, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    grid.push({ year, month, day: d, isCurrentMonth: true });
  }

  // Trailing days from next month
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (grid.length < 42) {
    grid.push({ year: nextYear, month: nextMonth, day: nextDay++, isCurrentMonth: false });
  }

  return grid;
}

function isToday(y: number, m: number, d: number): boolean {
  return y === TODAY.y && m === TODAY.m && d === TODAY.d;
}

function isSameDay(
  a: { y: number; m: number; d: number },
  b: { year: number; month: number; day: number }
): boolean {
  return a.y === b.year && a.m === b.month && a.d === b.day;
}

// ─── Calendar color map ──────────────────────────────────────────────────────

function getCalendar(id: string): MyCalendar | undefined {
  return MY_CALENDARS.find((c) => c.id === id);
}

// ─── Add Event Modal ─────────────────────────────────────────────────────────

interface AddEventModalProps {
  onAdd: (event: CalendarEvent) => void;
  onClose: () => void;
  nextId: number;
}

function AddEventModal({ onAdd, onClose, nextId }: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("15");
  const [time, setTime] = useState("10:00 AM");
  const [calId, setCalId] = useState("personal");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseInt(day, 10);
    if (!title.trim() || isNaN(d) || d < 1 || d > 30) return;
    onAdd({
      id: `evt-new-${nextId}`,
      title: title.trim(),
      date: { y: 2026, m: 5, d },
      time: time.trim() || "All day",
      calendarId: calId,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-popover p-5 ring-1 ring-foreground/10 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-medium">Add Event</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Day (June 2026)</label>
              <input
                type="number"
                min={1}
                max={30}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Time</label>
              <input
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                placeholder="e.g. 9:00 AM"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Calendar</label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              value={calId}
              onChange={(e) => setCalId(e.target.value)}
            >
              {MY_CALENDARS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mini Month Calendar (sidebar) ──────────────────────────────────────────

interface MiniMonthProps {
  year: number;
  month: number;
}

function MiniMonth({ year, month }: MiniMonthProps) {
  const grid = buildMonthGrid(year, month);

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-0 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-0.5 text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {grid.map((cell, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center rounded-full text-[11px] leading-none",
              "h-6 w-full",
              !cell.isCurrentMonth && "text-muted-foreground/40",
              cell.isCurrentMonth && "text-foreground",
              isToday(cell.year, cell.month, cell.day) &&
                "bg-primary text-primary-foreground font-semibold"
            )}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main CalendarApp ────────────────────────────────────────────────────────

export function CalendarApp() {
  const [viewDate, setViewDate] = useState({ year: 2026, month: 5 });
  const [enabledCalendars, setEnabledCalendars] = useState<Set<string>>(
    () => new Set(MY_CALENDARS.map((c) => c.id))
  );
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [nextId, setNextId] = useState(1);

  const { year, month } = viewDate;
  const grid = buildMonthGrid(year, month);

  function prevMonth() {
    setViewDate(({ year: y, month: m }) => {
      if (m === 0) return { year: y - 1, month: 11 };
      return { year: y, month: m - 1 };
    });
  }

  function nextMonth() {
    setViewDate(({ year: y, month: m }) => {
      if (m === 11) return { year: y + 1, month: 0 };
      return { year: y, month: m + 1 };
    });
  }

  function resetToToday() {
    setViewDate({ year: 2026, month: 5 });
  }

  function toggleCalendar(id: string) {
    setEnabledCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addEvent(event: CalendarEvent) {
    setEvents((prev) => [...prev, event]);
    setNextId((n) => n + 1);
  }

  // Filter events by enabled calendars
  const visibleEvents = events.filter((e) => enabledCalendars.has(e.calendarId));

  // Upcoming events: sorted by date, from Jun 7 onwards, first 5
  const upcomingEvents = visibleEvents
    .filter((e) => {
      const d = new Date(e.date.y, e.date.m, e.date.d);
      const todayDate = new Date(TODAY.y, TODAY.m, TODAY.d);
      return d >= todayDate;
    })
    .sort((a, b) => {
      const da = new Date(a.date.y, a.date.m, a.date.d).getTime();
      const db = new Date(b.date.y, b.date.m, b.date.d).getTime();
      return da - db;
    })
    .slice(0, 5);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {/* Month + Nav */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-semibold">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={resetToToday}>
          Today
        </Button>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground">
            Month
          </button>
          <button className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            Week
          </button>
          <button className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            Day
          </button>
        </div>

        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus />
            Add Event
          </Button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className="flex w-56 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r p-4">
          {/* Mini month */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {MONTH_NAMES[month]} {year}
            </p>
            <MiniMonth year={year} month={month} />
          </div>

          <Separator />

          {/* My Calendars */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Calendars
            </p>
            <div className="flex flex-col gap-2">
              {MY_CALENDARS.map((cal) => (
                <label
                  key={cal.id}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Checkbox
                    checked={enabledCalendars.has(cal.id)}
                    onCheckedChange={() => toggleCalendar(cal.id)}
                  />
                  <span className={cn("size-2.5 rounded-full flex-shrink-0", cal.dotColor)} />
                  <span className="text-sm">{cal.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Upcoming Events */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming
            </p>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingEvents.map((evt) => {
                  const cal = getCalendar(evt.calendarId);
                  return (
                    <div key={evt.id} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 size-2 flex-shrink-0 rounded-full",
                          cal?.dotColor ?? "bg-muted"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-tight">{evt.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Jun {evt.date.d} · {evt.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Month Grid ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {WEEKDAY_HEADERS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid rows — 6 weeks = 42 cells */}
          <div className="grid flex-1 grid-cols-7 grid-rows-6">
            {grid.map((cell, idx) => {
              const dayEvents = visibleEvents.filter((e) => isSameDay(e.date, cell));
              const shown = dayEvents.slice(0, 2);
              const extra = dayEvents.length - 2;
              const today = isToday(cell.year, cell.month, cell.day);

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col gap-0.5 border-b border-r p-1 min-h-0",
                    // Remove right border on last column
                    (idx + 1) % 7 === 0 && "border-r-0",
                    // Remove bottom border on last row
                    idx >= 35 && "border-b-0",
                    !cell.isCurrentMonth && "bg-muted/20"
                  )}
                >
                  {/* Day number */}
                  <div className="flex h-6 items-start justify-between px-0.5">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs leading-none",
                        today && "bg-primary text-primary-foreground font-semibold",
                        !today && cell.isCurrentMonth && "text-foreground",
                        !today && !cell.isCurrentMonth && "text-muted-foreground/50"
                      )}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {/* Event chips */}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {shown.map((evt) => {
                      const cal = getCalendar(evt.calendarId);
                      return (
                        <div
                          key={evt.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white font-medium",
                            cal?.color ?? "bg-muted"
                          )}
                          title={evt.title}
                        >
                          {evt.time !== "All day" && (
                            <span className="opacity-80 mr-0.5">{evt.time}</span>
                          )}
                          {evt.title}
                        </div>
                      );
                    })}
                    {extra > 0 && (
                      <div className="px-1 text-[10px] text-muted-foreground font-medium">
                        +{extra} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <AddEventModal
          onAdd={addEvent}
          onClose={() => setShowAddModal(false)}
          nextId={nextId}
        />
      )}
    </div>
  );
}
