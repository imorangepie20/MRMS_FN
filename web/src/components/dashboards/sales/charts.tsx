"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
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
import { revenueData } from "./data";

// ─── Revenue Area Chart ───────────────────────────────────────────────────────

const revenueChartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile:  { label: "Mobile",  color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RevenueCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>Last 28 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueChartConfig} className="h-64 w-full">
          <AreaChart data={revenueData} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="desktopGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-desktop)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="mobileGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-mobile)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0}    />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="desktop"
              stroke="var(--color-desktop)"
              strokeWidth={2}
              fill="url(#desktopGradient)"
            />
            <Area
              type="monotone"
              dataKey="mobile"
              stroke="var(--color-mobile)"
              strokeWidth={2}
              fill="url(#mobileGradient)"
            />
          </AreaChart>
        </ChartContainer>
        <div className="mt-4 flex gap-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-1)]" />
            <span className="text-muted-foreground">
              Desktop <span className="font-medium text-foreground">13,746</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-2)]" />
            <span className="text-muted-foreground">
              Mobile <span className="font-medium text-foreground">13,580</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
