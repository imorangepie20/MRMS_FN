"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { genderVisitData, departmentData } from "./data";

// ─── Patient Visits by Gender ─────────────────────────────────────────────────

const genderChartConfig = {
  male:   { label: "Male",   color: "var(--chart-1)" },
  female: { label: "Female", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function PatientVisitsByGenderCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Visits by Gender</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={genderChartConfig} className="h-56 w-full">
          <BarChart data={genderVisitData} barCategoryGap="30%">
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
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="male"   fill="var(--color-male)"   radius={[4, 4, 0, 0]} />
            <Bar dataKey="female" fill="var(--color-female)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Patients by Department ───────────────────────────────────────────────────

const departmentChartConfig = {
  patients: { label: "Patients", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PatientsByDepartmentCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patients by Department</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={departmentChartConfig} className="h-56 w-full">
          <BarChart data={departmentData} barCategoryGap="30%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="department"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="patients"
              fill="var(--color-patients)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
