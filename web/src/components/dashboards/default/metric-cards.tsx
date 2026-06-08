"use client";

import { Bar, BarChart, Area, AreaChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { subscriptionsSeries, revenueSeries } from "@/lib/data";

const subsConfig = {
  value: { label: "Subscriptions", color: "var(--chart-1)" },
} satisfies ChartConfig;

const revConfig = {
  value: { label: "Revenue", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function SubscriptionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Subscriptions</CardDescription>
        <CardTitle className="text-3xl tabular-nums">+4850</CardTitle>
        <p className="text-xs text-muted-foreground">+180.1% from last month</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={subsConfig} className="h-24 w-full">
          <BarChart data={subscriptionsSeries}>
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function TotalRevenueCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Total Revenue</CardDescription>
        <CardTitle className="text-3xl tabular-nums">$15,231.89</CardTitle>
        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revConfig} className="h-24 w-full">
          <AreaChart data={revenueSeries}>
            <Area
              dataKey="value"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
