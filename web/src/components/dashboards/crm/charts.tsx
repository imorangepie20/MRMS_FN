"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { leadsBySource } from "./data";

// ─── Leads by Source Bar Chart ────────────────────────────────────────────────

const leadsChartConfig = {
  count: { label: "Leads", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function LeadsBySourceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads by Source</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={leadsChartConfig} className="h-52 w-full">
          <BarChart data={leadsBySource} barCategoryGap="35%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="source"
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
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
