"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { tasks, pipelineStages, leads } from "./data";
import type { TaskPriority, LeadStatus } from "./data";

// ─── Monthly Target (Radial-style progress) ───────────────────────────────────

const TARGET_PCT = 48;

export function MonthlyTargetCard() {
  const circumference = 2 * Math.PI * 52; // r=52
  const strokeDashoffset = circumference * (1 - TARGET_PCT / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your target is incomplete</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {/* Circular progress using SVG */}
        <div className="relative flex items-center justify-center">
          <svg width={120} height={120} className="-rotate-90" role="img" aria-label={`Target progress: ${TARGET_PCT}%`}>
            {/* Track */}
            <circle
              cx={60}
              cy={60}
              r={52}
              fill="none"
              strokeWidth={10}
              className="stroke-muted"
            />
            {/* Indicator */}
            <circle
              cx={60}
              cy={60}
              r={52}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          {/* Center label */}
          <span className="absolute text-2xl font-semibold tabular-nums">
            {TARGET_PCT}%
          </span>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          You&apos;re almost there — keep going to hit your monthly target.
        </p>
        <div className="flex w-full items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular-nums">{TARGET_PCT}%</span>
        </div>
        <Progress value={TARGET_PCT} className="w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  high: {
    label: "High",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  low: {
    label: "Low",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

export function TasksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {tasks.map((task) => {
            const cfg = priorityConfig[task.priority];
            return (
              <li
                key={task.title}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.dueDate}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 border-transparent", cfg.className)}
                >
                  {cfg.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Sales Pipeline ───────────────────────────────────────────────────────────

export function SalesPipelineCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {pipelineStages.map((stage) => (
            <div key={stage.stage} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{stage.stage}</span>
                  <span className="text-xs text-muted-foreground">
                    {stage.deals} deals
                  </span>
                </div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-medium">{stage.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {stage.percent}%
                  </span>
                </div>
              </div>
              <Progress value={stage.percent} className="w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Leads Table ─────────────────────────────────────────────────────────────

const leadStatusConfig: Record<LeadStatus, { className: string }> = {
  New: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  Contacted: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  Qualified: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  Lost: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function LeadsTableCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const cfg = leadStatusConfig[lead.status];
              return (
                <TableRow key={lead.id}>
                  <TableCell className="pl-(--card-spacing)">
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.email}
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums font-medium">
                    {lead.amount}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
