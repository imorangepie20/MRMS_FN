"use client";

import { Phone, MessageCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  reminders,
  leadAgents,
  activeListings,
  calendarAppointments,
} from "./data";
import type { PropertyStatus } from "./data";

// ─── Featured Property ────────────────────────────────────────────────────────

export function FeaturedPropertyCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Featured Property</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Banner placeholder */}
        <div className="relative h-32 w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-700">
          <div className="absolute inset-0 flex items-end p-3">
            <span className="text-lg font-bold text-white drop-shadow">
              The Somerset
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tabular-nums">175</span>
            <span className="text-xs text-muted-foreground">Sold</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tabular-nums">125</span>
            <span className="text-xs text-muted-foreground">Rented</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tabular-nums">2K+</span>
            <span className="text-xs text-muted-foreground">Views</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-1 border-t pt-3 text-sm text-muted-foreground">
          <span>Recommended to <strong className="text-foreground">14 Leads</strong></span>
          <span><strong className="text-foreground">42 Closed Deals</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── On Progress Deals ────────────────────────────────────────────────────────

export function OnProgressDealsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On Progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <span className="text-5xl font-bold tabular-nums">132</span>
        <span className="mt-1 text-sm text-muted-foreground">Deals</span>
      </CardContent>
    </Card>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export function RemindersCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {reminders.map((reminder) => (
            <li
              key={reminder.title}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-medium leading-tight">
                {reminder.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {reminder.date}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Leads Contact ────────────────────────────────────────────────────────────

export function LeadsContactCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {leadAgents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{agent.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{agent.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {agent.location}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8">
                  <Phone className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8">
                  <MessageCircle className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Active Listing Table ─────────────────────────────────────────────────────

const statusConfig: Record<PropertyStatus, string> = {
  Active:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Sold:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function ActiveListingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Listing</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Property</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Active Leads</TableHead>
              <TableHead>Views</TableHead>
              <TableHead className="pr-(--card-spacing)">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeListings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell className="pl-(--card-spacing)">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block size-2.5 shrink-0 rounded-sm",
                        listing.colorClass
                      )}
                    />
                    <span className="font-medium">{listing.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {listing.location}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {listing.type}
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  {listing.cost}
                </TableCell>
                <TableCell className="tabular-nums text-center">
                  {listing.activeLeads}
                </TableCell>
                <TableCell className="tabular-nums">
                  {listing.views.toLocaleString()}
                </TableCell>
                <TableCell className="pr-(--card-spacing)">
                  <Badge
                    variant="outline"
                    className={cn("border-transparent", statusConfig[listing.status])}
                  >
                    {listing.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export function CalendarCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          defaultMonth={new Date(2025, 5, 1)}
          className="w-full"
        />

        {/* Appointments */}
        <div className="flex flex-col gap-2 border-t pt-3">
          {calendarAppointments.map((appt) => (
            <div key={appt.title} className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-tight">{appt.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                {appt.date}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
