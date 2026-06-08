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
import { transferData } from "./data";

const transferChartConfig = {
  uploaded:   { label: "Uploaded",   color: "var(--chart-1)" },
  downloaded: { label: "Downloaded", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function MonthlyFileTransferCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Monthly File Transfer</CardTitle>
        <CardDescription>11 May 2026 - 07 Jun 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={transferChartConfig} className="h-64 w-full">
          <AreaChart data={transferData} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="uploadedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-uploaded)"   stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-uploaded)"   stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="downloadedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-downloaded)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-downloaded)" stopOpacity={0}    />
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
              unit=" MB"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="uploaded"
              stroke="var(--color-uploaded)"
              strokeWidth={2}
              fill="url(#uploadedGradient)"
            />
            <Area
              type="monotone"
              dataKey="downloaded"
              stroke="var(--color-downloaded)"
              strokeWidth={2}
              fill="url(#downloadedGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
