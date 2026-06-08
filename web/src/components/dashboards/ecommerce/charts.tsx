"use client";

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
import { Progress } from "@/components/ui/progress";
import { revenueData, locationData, visitSourceData } from "./data";

// ─── Total Revenue Bar Chart ──────────────────────────────────────────────────

const revenueChartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function TotalRevenueCard() {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
        <CardDescription>Last 28 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueChartConfig} className="h-64 w-full">
          <BarChart data={revenueData} barCategoryGap="30%">
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
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 flex gap-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-1)]" />
            <span className="text-muted-foreground">
              Desktop <span className="font-medium text-foreground">24,828</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-2)]" />
            <span className="text-muted-foreground">
              Mobile <span className="font-medium text-foreground">25,010</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sales by Location ────────────────────────────────────────────────────────

export function SalesByLocationCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Sales by Location</CardTitle>
            <CardDescription className="mt-1">Geographic distribution</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">$42,379</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">+2.5%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {locationData.map((item) => (
            <div key={item.country} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm text-muted-foreground">
                {item.country}
              </span>
              <div className="flex-1">
                <Progress value={item.value} max={100} />
              </div>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums">
                {item.percent}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Store Visits by Source (Donut) ──────────────────────────────────────────

const donutConfig = {
  Direct: { label: "Direct", color: "var(--chart-1)" },
  Social: { label: "Social", color: "var(--chart-2)" },
  Email: { label: "Email", color: "var(--chart-3)" },
  Referral: { label: "Referral", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function StoreVisitsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Visits by Source</CardTitle>
        <CardDescription>Traffic breakdown by channel</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ChartContainer config={donutConfig} className="h-52 w-full max-w-xs">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
            <Pie
              data={visitSourceData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
            >
              {visitSourceData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {visitSourceData.map((src) => (
            <div key={src.name} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: src.fill }}
              />
              <span className="text-muted-foreground">
                {src.name}{" "}
                <span className="font-medium text-foreground">{src.value}%</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
