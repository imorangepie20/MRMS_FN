export interface CalendarEvent {
  id: string;
  title: string;
  date: { y: number; m: number; d: number };
  time: string;
  calendarId: string;
}

export interface MyCalendar {
  id: string;
  name: string;
  color: string; // Tailwind bg color class
  dotColor: string; // Tailwind bg color for dot
}

export const MY_CALENDARS: MyCalendar[] = [
  { id: "personal", name: "Personal", color: "bg-blue-500", dotColor: "bg-blue-500" },
  { id: "work", name: "Work", color: "bg-emerald-500", dotColor: "bg-emerald-500" },
  { id: "family", name: "Family", color: "bg-amber-500", dotColor: "bg-amber-500" },
  { id: "holidays", name: "Holidays", color: "bg-red-500", dotColor: "bg-red-500" },
];

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Team Standup",
    date: { y: 2026, m: 5, d: 2 },
    time: "9:00 AM",
    calendarId: "work",
  },
  {
    id: "evt-2",
    title: "Dad's Birthday",
    date: { y: 2026, m: 5, d: 7 },
    time: "All day",
    calendarId: "family",
  },
  {
    id: "evt-3",
    title: "Doctor Appointment",
    date: { y: 2026, m: 5, d: 10 },
    time: "2:30 PM",
    calendarId: "personal",
  },
  {
    id: "evt-4",
    title: "Sprint Planning",
    date: { y: 2026, m: 5, d: 15 },
    time: "10:00 AM",
    calendarId: "work",
  },
  {
    id: "evt-5",
    title: "Juneteenth",
    date: { y: 2026, m: 5, d: 19 },
    time: "All day",
    calendarId: "holidays",
  },
  {
    id: "evt-6",
    title: "Family BBQ",
    date: { y: 2026, m: 5, d: 20 },
    time: "1:00 PM",
    calendarId: "family",
  },
  {
    id: "evt-7",
    title: "Design Review",
    date: { y: 2026, m: 5, d: 22 },
    time: "3:00 PM",
    calendarId: "work",
  },
  {
    id: "evt-8",
    title: "Gym Session",
    date: { y: 2026, m: 5, d: 24 },
    time: "7:00 AM",
    calendarId: "personal",
  },
  {
    id: "evt-9",
    title: "Client Demo",
    date: { y: 2026, m: 5, d: 24 },
    time: "2:00 PM",
    calendarId: "work",
  },
  {
    id: "evt-10",
    title: "Anniversary Dinner",
    date: { y: 2026, m: 5, d: 28 },
    time: "7:30 PM",
    calendarId: "family",
  },
];
