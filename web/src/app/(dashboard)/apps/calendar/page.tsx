import { CalendarApp } from "@/components/apps/calendar/calendar-app";

export default function CalendarPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <CalendarApp />
    </div>
  );
}
