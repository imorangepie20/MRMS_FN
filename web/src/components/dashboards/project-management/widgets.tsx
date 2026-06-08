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
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { reminders, recentProjects } from "./data";
import type { ReminderPriority, ProjectStatus } from "./data";

// ─── Professionals ────────────────────────────────────────────────────────────

const todaysHeroes = [
  { initials: "AM", color: "bg-violet-200 text-violet-700" },
  { initials: "BT", color: "bg-blue-200 text-blue-700" },
  { initials: "CK", color: "bg-emerald-200 text-emerald-700" },
  { initials: "DR", color: "bg-amber-200 text-amber-700" },
  { initials: "EL", color: "bg-rose-200 text-rose-700" },
];

export function ProfessionalsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Professionals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-4xl font-bold tabular-nums">357</p>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Today&apos;s Heroes</p>
          <AvatarGroup>
            {todaysHeroes.map((hero) => (
              <Avatar key={hero.initials}>
                <AvatarFallback className={hero.color}>
                  {hero.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Highlights ───────────────────────────────────────────────────────────────

const highlights = [
  { label: "Avg. Client Rating", value: "7.8 / 10" },
  { label: "Avg. Quotes",        value: "730"      },
  { label: "Avg. Agent Earnings", value: "$2,309"  },
];

export function HighlightsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <span className="text-lg font-semibold tabular-nums leading-tight">
                {h.value}
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                {h.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────

const reminderPriorityConfig: Record<
  ReminderPriority,
  { className: string }
> = {
  High: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  Medium: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  Low: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

export function RemindersCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y">
          {reminders.map((reminder) => {
            const cfg = reminderPriorityConfig[reminder.priority];
            return (
              <li
                key={reminder.title}
                className="flex items-center justify-between gap-3 py-3 first:pt-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {reminder.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {reminder.due}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 border-transparent", cfg.className)}
                >
                  {reminder.priority}
                </Badge>
              </li>
            );
          })}
        </ul>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">
          Show the other 10 reminders
        </button>
      </CardContent>
    </Card>
  );
}

// ─── Recent Projects Table ────────────────────────────────────────────────────

const projectStatusConfig: Record<ProjectStatus, { className: string }> = {
  "In Progress": {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  Completed: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  "On Hold": {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

export function RecentProjectsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Projects</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">
                Project Name
              </TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-(--card-spacing) min-w-36">
                Progress
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentProjects.map((project) => {
              const cfg = projectStatusConfig[project.status];
              return (
                <TableRow key={project.name}>
                  <TableCell className="pl-(--card-spacing) font-medium">
                    {project.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.client}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.startDate}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.deadline}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-(--card-spacing)">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={project.progress}
                        className="w-20 h-1.5"
                      />
                      <span className="tabular-nums text-xs text-muted-foreground w-8 shrink-0">
                        {project.progress}%
                      </span>
                    </div>
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
