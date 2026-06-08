"use client";

import {
  Area,
  AreaChart,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { sessionData, trafficSources } from "./data";

// ─── Traffic Overview (Area Chart) ───────────────────────────────────────────

const sessionChartConfig = {
  sessions: { label: "Sessions", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TrafficOverviewCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Traffic Overview</CardTitle>
        <CardDescription>Last 28 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={sessionChartConfig} className="h-64 w-full">
          <AreaChart data={sessionData} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-sessions)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="var(--color-sessions)"
              strokeWidth={2}
              fill="url(#sessionsGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Traffic Sources (Donut Chart) ───────────────────────────────────────────

const donutConfig = {
  Direct:   { label: "Direct",   color: "var(--chart-1)" },
  Organic:  { label: "Organic",  color: "var(--chart-2)" },
  Referral: { label: "Referral", color: "var(--chart-3)" },
  Social:   { label: "Social",   color: "var(--chart-4)" },
} satisfies ChartConfig;

export function TrafficSourcesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Sources</CardTitle>
        <CardDescription>Channel breakdown</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ChartContainer config={donutConfig} className="h-48 w-full max-w-xs">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
            <Pie
              data={trafficSources}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
            >
              {trafficSources.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {trafficSources.map((src) => (
            <div key={src.name} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: src.fill }}
              />
              <span className="text-muted-foreground">
                {src.name}{" "}
                <span className="font-medium text-foreground">{src.value}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex w-full justify-around border-t pt-4 text-sm">
          <div className="text-center">
            <p className="font-semibold tabular-nums">2.3K</p>
            <p className="text-xs text-muted-foreground">Page Views</p>
          </div>
          <div className="text-center">
            <p className="font-semibold tabular-nums">1.6K</p>
            <p className="text-xs text-muted-foreground">Leads</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
