"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { exerciseSeries } from "@/lib/data";

const config = {
  thisMonth: { label: "This Month", color: "var(--chart-1)" },
  average: { label: "Average", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ExerciseCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exercise Minutes</CardTitle>
        <CardDescription>Your exercise minutes are ahead of where you normally are.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">Export</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart data={exerciseSeries} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="thisMonth" stroke="var(--color-thisMonth)" strokeWidth={2} dot={false} />
            <Line dataKey="average" stroke="var(--color-average)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
