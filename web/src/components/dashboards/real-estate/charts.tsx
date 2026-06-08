"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
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
  revenueDataWeekly,
  revenueDataMonthly,
  revenueDataYearly,
  salesAnalyticsData,
  propertyOverviewData,
} from "./data";

// ─── Revenue / Visit ──────────────────────────────────────────────────────────

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  visits:  { label: "Visits",  color: "var(--chart-2)" },
} satisfies ChartConfig;

type RevPeriod = "W" | "M" | "Y";

const revDataMap = {
  W: revenueDataWeekly,
  M: revenueDataMonthly,
  Y: revenueDataYearly,
} as const;

export function RevenueVisitCard() {
  const [period, setPeriod] = useState<RevPeriod>("M");
  const data = revDataMap[period];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle>Revenue / Visit</CardTitle>
          <Tabs value={period} onValueChange={(v) => { if (v != null) setPeriod(v as RevPeriod); }}>
            <TabsList>
              {(["W", "M", "Y"] as RevPeriod[]).map((p) => (
                <TabsTrigger key={p} value={p}>
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueChartConfig} className="h-56 w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 1000000 ? `$${(v / 1000000).toFixed(0)}M` : `$${(v / 1000).toFixed(0)}K`
              }
            />
            <YAxis
              yAxisId="visits"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              fill="url(#revGrad)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              yAxisId="visits"
              type="monotone"
              dataKey="visits"
              stroke="var(--color-visits)"
              fill="url(#visGrad)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Sales Analytics ─────────────────────────────────────────────────────────

const salesChartConfig = {
  online:    { label: "Online",    color: "var(--chart-1)" },
  offline:   { label: "Offline",   color: "var(--chart-2)" },
  agent:     { label: "Agent",     color: "var(--chart-3)" },
  marketing: { label: "Marketing", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function SalesAnalyticsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={salesChartConfig} className="h-56 w-full">
          <BarChart data={salesAnalyticsData} barCategoryGap="20%" barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
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
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="online"    fill="var(--color-online)"    radius={[3, 3, 0, 0]} />
            <Bar dataKey="offline"   fill="var(--color-offline)"   radius={[3, 3, 0, 0]} />
            <Bar dataKey="agent"     fill="var(--color-agent)"     radius={[3, 3, 0, 0]} />
            <Bar dataKey="marketing" fill="var(--color-marketing)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {(["online", "offline", "agent", "marketing"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: `var(--color-${key})` }}
              />
              {salesChartConfig[key].label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Property Overview ────────────────────────────────────────────────────────

const totalProperties = 1323;

const propertyChartConfig = {
  Listed: { label: "Listed", color: "var(--chart-1)" },
  Sold:   { label: "Sold",   color: "var(--chart-2)" },
} satisfies ChartConfig;

export function PropertyOverviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative">
          <ChartContainer config={propertyChartConfig} className="h-48 w-full max-w-xs">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie
                data={propertyOverviewData}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={84}
                paddingAngle={3}
              >
                {propertyOverviewData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">
              {totalProperties.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Properties</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex w-full flex-col gap-2">
          {propertyOverviewData.map((entry) => {
            const pct = Math.round((entry.value / totalProperties) * 100);
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
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
