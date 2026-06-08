"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { exchangeRateData } from "./data";

const exchangeChartConfig = {
  rate: { label: "EUR/USD", color: "var(--chart-1)" },
} satisfies ChartConfig;

const PERIODS = ["1D", "7D", "30D", "90D", "1Y"] as const;

export function ExchangeRatesCard() {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Exchange Rates</CardTitle>
          <CardDescription>Last updated: 11:08 AM</CardDescription>
        </div>
        <Tabs defaultValue="7D" className="mt-2">
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ChartContainer config={exchangeChartConfig} className="h-52 w-full">
          <AreaChart data={exchangeRateData} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-rate)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-rate)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--color-rate)"
              strokeWidth={2}
              fill="url(#rateGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
