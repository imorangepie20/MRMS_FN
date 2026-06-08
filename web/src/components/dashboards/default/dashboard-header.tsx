"use client";

import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dashboardDateRange } from "@/lib/data";

export function DashboardHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="gap-2">
                <CalendarDays className="size-4" />
                {dashboardDateRange}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="range" numberOfMonths={2} />
          </PopoverContent>
        </Popover>
        <Button className="gap-2">
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
