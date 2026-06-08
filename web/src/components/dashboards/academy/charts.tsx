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
import { activityBreakdown, courseProgressData } from "./data";

// ─── Activity Breakdown (Donut) ───────────────────────────────────────────────

const activityConfig = {
  Mentoring:    { label: "Mentoring",    color: "var(--chart-1)" },
  Organization: { label: "Organization", color: "var(--chart-2)" },
  Planning:     { label: "Planning",     color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ActivityBreakdownCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ChartContainer config={activityConfig} className="h-52 w-full max-w-xs">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
            <Pie
              data={activityBreakdown}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
            >
              {activityBreakdown.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex w-full flex-col gap-2">
          {activityBreakdown.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-medium tabular-nums">{entry.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Course Progress by Month (Area Chart) ────────────────────────────────────

const courseProgressConfig = {
  courses: { label: "Courses", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function CourseProgressCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Progress by Month</CardTitle>
        <CardDescription>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            50.56% increase
          </span>
          {" · "}11 May 2026 – 07 Jun 2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={courseProgressConfig} className="h-64 w-full">
          <AreaChart data={courseProgressData} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="coursesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-courses)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-courses)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
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
              dataKey="courses"
              stroke="var(--color-courses)"
              strokeWidth={2}
              fill="url(#coursesGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
