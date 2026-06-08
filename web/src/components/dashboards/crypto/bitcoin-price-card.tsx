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
import { btcPriceData } from "./data";

const chartConfig = {
  price: { label: "BTC Price", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function BitcoinPriceCard() {
  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardDescription>Bitcoin Price</CardDescription>
            <CardTitle className="text-2xl tabular-nums">$46,200</CardTitle>
            <CardDescription className="mt-0.5 text-xs">Last 7 days</CardDescription>
          </div>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            +12%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <AreaChart data={btcPriceData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10 }}
              interval={5}
              tickFormatter={(v: string) => v.split(" ")[0]}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10 }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `$${Number(value).toLocaleString()}`
                  }
                />
              }
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--color-price)"
              strokeWidth={2}
              fill="url(#btcGradient)"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
