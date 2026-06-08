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
import { cn } from "@/lib/utils";
import {
  reservationStatuses,
  campaignStats,
  recentActivities,
  bookingList,
} from "./data";

// ─── Total Sales This Week ────────────────────────────────────────────────────

export function TotalSalesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Sales This Week</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">$86,000</p>
      </CardContent>
    </Card>
  );
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

export function RevenueCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">$12,480.00</p>
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
          +16% from last month
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export function ReservationsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {reservationStatuses.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn("inline-block size-2.5 shrink-0 rounded-full", s.color)}
                />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Campaign Overview ────────────────────────────────────────────────────────

export function CampaignOverviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {campaignStats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Activities ────────────────────────────────────────────────────────

export function RecentActivitiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {recentActivities.map((a) => (
            <div key={a.name} className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{a.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.room}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {a.minsAgo} mins ago
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge config ──────────────────────────────────────────────────────

const statusConfig = {
  Confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Checked In": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
} as const;

// ─── Booking List ─────────────────────────────────────────────────────────────

export function BookingListCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking List</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Booking ID</TableHead>
              <TableHead>Guest Name</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead>Room Number</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Check-Out</TableHead>
              <TableHead className="pr-(--card-spacing)">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookingList.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="pl-(--card-spacing) font-medium tabular-nums">
                  {b.id}
                </TableCell>
                <TableCell>{b.guest}</TableCell>
                <TableCell className="text-muted-foreground">{b.roomType}</TableCell>
                <TableCell className="tabular-nums">{b.roomNumber}</TableCell>
                <TableCell className="text-muted-foreground">{b.duration}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {b.checkIn}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {b.checkOut}
                </TableCell>
                <TableCell className="pr-(--card-spacing)">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent",
                      statusConfig[b.status]
                    )}
                  >
                    {b.status}
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
