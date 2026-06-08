import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboards/shared/kpi-card";
import { leaderboard, popularCourses } from "./data";

// ─── Greeting Banner ─────────────────────────────────────────────────────────

export function GreetingBanner() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xl font-semibold">Hi, Andrew 👋</p>
          <p className="text-sm text-muted-foreground">
            Continue your learning journey — you&apos;re doing great.
          </p>
        </div>
        <Button className="w-fit">Continue Learning</Button>
      </CardContent>
    </Card>
  );
}

// ─── Learning Path ────────────────────────────────────────────────────────────

export function LearningPathCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Learning Path</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Full-Stack Developer</p>
          <p className="text-sm text-muted-foreground">4 of 10 modules completed</p>
        </div>
        <Progress value={40} className="h-2" />
        <p className="text-xs text-muted-foreground">40% complete</p>
      </CardContent>
    </Card>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export function LeaderboardCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {leaderboard.map((entry) => (
            <li key={entry.rank} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {entry.rank}
              </span>
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className={entry.color + " text-xs"}>
                  {entry.initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium">{entry.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {entry.points.toLocaleString()} pts
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Success Rate ─────────────────────────────────────────────────────────────

export function SuccessRateCard() {
  return (
    <KpiCard
      label="Success Rate"
      value="88%"
      delta="+3%"
      trend="up"
      sublabel="· target 100%"
    />
  );
}

// ─── Total Students ───────────────────────────────────────────────────────────

export function TotalStudentsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Students</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-4xl font-bold tabular-nums">1,500</p>
        <p className="text-sm text-muted-foreground">
          1,320 passing (88.0%)
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Progress Statistics ──────────────────────────────────────────────────────

export function ProgressStatisticsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Statistics</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Activity</span>
            <span className="font-medium tabular-nums">72.5%</span>
          </div>
          <Progress value={72.5} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-2xl font-semibold tabular-nums">18</span>
            <span className="text-xs text-muted-foreground">In Progress</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-2xl font-semibold tabular-nums">30</span>
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Popular Courses ──────────────────────────────────────────────────────────

export function PopularCoursesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular Courses</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Course</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="pr-(--card-spacing) w-40">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {popularCourses.map((course) => (
              <TableRow key={course.name}>
                <TableCell className="pl-(--card-spacing) font-medium">
                  {course.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {course.category}
                </TableCell>
                <TableCell className="tabular-nums">
                  ⭐ {course.score.toFixed(1)}
                </TableCell>
                <TableCell className="pr-(--card-spacing)">
                  <div className="flex items-center gap-2">
                    <Progress value={course.progress} className="h-1.5 flex-1" />
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {course.progress}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
