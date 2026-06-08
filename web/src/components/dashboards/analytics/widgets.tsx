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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { countrySales, campaignStats } from "./data";

// ─── Support Card ─────────────────────────────────────────────────────────────

const supportStats = [
  { label: "New Tickets",    value: "40" },
  { label: "Open Tickets",   value: "25" },
  { label: "Response Time",  value: "1 Day" },
];

export function SupportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Support</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 divide-x">
          {supportStats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 px-3 first:pl-0 last:pr-0">
              <span className="text-2xl font-semibold tabular-nums">{stat.value}</span>
              <span className="text-center text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sales Snapshot Card ──────────────────────────────────────────────────────

export function SalesSnapshotCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Average Daily Sales</p>
          <p className="text-2xl font-semibold tabular-nums">$28,450</p>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sales Overview</span>
              <span className="font-medium">$42.5K</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Orders</span>
              <span className="tabular-nums">62.2%</span>
            </div>
            <Progress value={62.2} className="h-2" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Visits</span>
              <span className="tabular-nums">25.5%</span>
            </div>
            <Progress value={25.5} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sales by Countries Card ──────────────────────────────────────────────────

export function SalesByCountriesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Countries</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Country</TableHead>
              <TableHead>Change</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countrySales.map((row) => (
              <TableRow key={row.country}>
                <TableCell className="pl-(--card-spacing) font-medium">
                  <span className="mr-2">{row.flag}</span>
                  {row.country}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums",
                    row.positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {row.change}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {row.revenue}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Monthly Campaign State Card ──────────────────────────────────────────────

export function MonthlyCampaignCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Campaign State</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Metric</TableHead>
              <TableHead>Count</TableHead>
              <TableHead className="pr-(--card-spacing)">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaignStats.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className="pl-(--card-spacing) font-medium">
                  {row.metric}
                </TableCell>
                <TableCell className="tabular-nums">{row.count}</TableCell>
                <TableCell
                  className={cn(
                    "pr-(--card-spacing) tabular-nums",
                    row.positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {row.change}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
