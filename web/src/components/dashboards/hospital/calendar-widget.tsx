"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";

export function CalendarCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 px-2">
        <Calendar mode="single" defaultMonth={new Date(2026, 5, 1)} />
        <Separator />
        <p className="text-sm text-muted-foreground">No appointments for this day</p>
      </CardContent>
    </Card>
  );
}
