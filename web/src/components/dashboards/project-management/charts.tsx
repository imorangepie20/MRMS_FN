"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  projectsOverview3Months,
  projectsOverview30Days,
  projectsOverview7Days,
  achievementByYear,
} from "./data";

// ─── Projects Overview ────────────────────────────────────────────────────────

const overviewChartConfig = {
  projects: { label: "Projects", color: "var(--chart-1)" },
} satisfies ChartConfig;

type OverviewPeriod = "3months" | "30days" | "7days";

const overviewDataMap: Record<OverviewPeriod, typeof projectsOverview3Months> =
  {
    "3months": projectsOverview3Months,
    "30days": projectsOverview30Days,
    "7days": projectsOverview7Days,
  };

export function ProjectsOverviewCard() {
  const [period, setPeriod] = useState<OverviewPeriod>("3months");
  const data = overviewDataMap[period];
  const description = {
    "3months": "Total for the last 3 months",
    "30days": "Total for the last 30 days",
    "7days": "Total for the last 7 days",
  }[period];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Projects Overview</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Tabs
            value={period}
            onValueChange={(v) => {
              if (v != null) setPeriod(v as OverviewPeriod);
            }}
          >
            <TabsList>
              <TabsTrigger value="3months">3 months</TabsTrigger>
              <TabsTrigger value="30days">30 days</TabsTrigger>
              <TabsTrigger value="7days">7 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={overviewChartConfig} className="h-56 w-full">
          <AreaChart data={data} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="projectsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-projects)"
                  stopOpacity={0.25}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-projects)"
                  stopOpacity={0}
                />
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
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="projects"
              stroke="var(--color-projects)"
              strokeWidth={2}
              fill="url(#projectsGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Achievement by Year ──────────────────────────────────────────────────────

const achievementChartConfig = {
  achieved: { label: "Achieved", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function AchievementByYearCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Achievement by Year</CardTitle>
        <CardDescription>January – June 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={achievementChartConfig} className="h-52 w-full">
          <BarChart data={achievementByYear} barCategoryGap="35%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: string) => v.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="achieved"
              fill="var(--color-achieved)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
