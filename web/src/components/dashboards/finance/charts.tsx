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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";
import { monthlyExpenses, expenseCategories } from "./data";

// ─── Monthly Expenses Area Chart ──────────────────────────────────────────────

const expensesChartConfig = {
  expenses: { label: "Expenses", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function MonthlyExpensesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={expensesChartConfig} className="h-64 w-full">
          <AreaChart data={monthlyExpenses} margin={{ left: -8 }}>
            <defs>
              <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-expenses)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0}    />
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
              dataKey="expenses"
              stroke="var(--color-expenses)"
              strokeWidth={2}
              fill="url(#expensesGradient)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
        Trending up by 5.2% this month
      </CardFooter>
    </Card>
  );
}

// ─── Expense Summary Donut ────────────────────────────────────────────────────

const expenseSummaryConfig = {
  "Food & Drink": { label: "Food & Drink", color: "var(--chart-1)" },
  Grocery:        { label: "Grocery",      color: "var(--chart-2)" },
  Shopping:       { label: "Shopping",     color: "var(--chart-3)" },
  Transport:      { label: "Transport",    color: "var(--chart-4)" },
} satisfies ChartConfig;

export function ExpenseSummaryCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ChartContainer config={expenseSummaryConfig} className="h-52 w-full max-w-xs">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
            <Pie
              data={expenseCategories}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
            >
              {expenseCategories.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {expenseCategories.map((cat) => (
            <div key={cat.name} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: cat.fill }}
              />
              <span className="text-muted-foreground">
                {cat.name}{" "}
                <span className="font-medium text-foreground">{cat.value}%</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
