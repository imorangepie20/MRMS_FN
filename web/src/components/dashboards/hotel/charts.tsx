"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bookingsDataDaily,
  bookingsDataWeekly,
  bookingsDataMonthly,
  bookingsDataYearly,
  onlineOfflineData,
} from "./data";

// ─── Bookings Chart ───────────────────────────────────────────────────────────

const bookingsChartConfig = {
  bookings: { label: "Bookings", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Period = "D" | "W" | "M" | "Y";

const dataMap: Record<Period, typeof bookingsDataMonthly> = {
  D: bookingsDataDaily,
  W: bookingsDataWeekly,
  M: bookingsDataMonthly,
  Y: bookingsDataYearly,
};

export function BookingsCard() {
  const [period, setPeriod] = useState<Period>("M");
  const data = dataMap[period];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Bookings</CardTitle>
            <p className="mt-1 text-2xl font-bold tabular-nums">20,395.50</p>
            <p className="text-xs text-muted-foreground">Total Bookings</p>
          </div>
          <Tabs
            value={period}
            onValueChange={(v) => { if (v != null) setPeriod(v as Period); }}
          >
            <TabsList>
              {(["D", "W", "M", "Y"] as Period[]).map((p) => (
                <TabsTrigger key={p} value={p}>
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={bookingsChartConfig} className="h-56 w-full">
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="bookings"
              fill="var(--color-bookings)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Online vs Offline Booking ────────────────────────────────────────────────

const onlineOfflineConfig = {
  Online:  { label: "Online",  color: "var(--chart-1)" },
  Offline: { label: "Offline", color: "var(--chart-2)" },
} satisfies ChartConfig;

const total = onlineOfflineData.reduce((s, d) => s + d.value, 0);

export function OnlineOfflineCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Online vs Offline Booking</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ChartContainer
          config={onlineOfflineConfig}
          className="h-44 w-full max-w-xs"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie
              data={onlineOfflineData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={3}
            >
              {onlineOfflineData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex w-full flex-col gap-2">
          {onlineOfflineData.map((entry) => {
            const pct = Math.round((entry.value / total) * 100);
            return (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <span className="font-medium tabular-nums">
                  {entry.value.toLocaleString()} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
