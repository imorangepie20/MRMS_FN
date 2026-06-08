"use client"

import * as React from "react"
import {
  ActivityIcon,
  CalendarIcon,
  CloudIcon,
  CreditCardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UploadIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"

import { KpiCard } from "@/components/dashboards/shared/kpi-card"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

// ── Static data (no Math.random / new Date in render) ──────────────────────

const ACTIVITY_ITEMS = [
  { id: 1, user: "Alice Martin", action: "created a new report", time: "2m ago", initials: "AM", color: "bg-violet-500" },
  { id: 2, user: "Bob Chen", action: "uploaded 3 files", time: "14m ago", initials: "BC", color: "bg-sky-500" },
  { id: 3, user: "Cara Lee", action: "commented on Task #42", time: "1h ago", initials: "CL", color: "bg-emerald-500" },
  { id: 4, user: "Dan Park", action: "closed Issue #19", time: "3h ago", initials: "DP", color: "bg-amber-500" },
  { id: 5, user: "Eva Ross", action: "invited a team member", time: "5h ago", initials: "ER", color: "bg-rose-500" },
]

const UPCOMING_EVENTS = [
  { id: 1, title: "Design review", date: "Mon, Jun 9", badge: "Today" },
  { id: 2, title: "Sprint planning", date: "Tue, Jun 10", badge: null },
  { id: 3, title: "Stakeholder demo", date: "Thu, Jun 12", badge: null },
  { id: 4, title: "Team retro", date: "Fri, Jun 13", badge: "Important" },
]

const TEAM_MEMBERS = [
  { initials: "AL", label: "Alice" },
  { initials: "BC", label: "Bob" },
  { initials: "CL", label: "Cara" },
  { initials: "DP", label: "Dan" },
  { initials: "ER", label: "Eva" },
]

const STORAGE_ITEMS = [
  { label: "Documents", value: 38, color: "bg-violet-500" },
  { label: "Images", value: 27, color: "bg-sky-500" },
  { label: "Videos", value: 22, color: "bg-amber-500" },
  { label: "Other", value: 13, color: "bg-muted-foreground/40" },
]

const QUICK_ACTIONS = [
  { label: "Dashboard", icon: LayoutDashboardIcon },
  { label: "Upload", icon: UploadIcon },
  { label: "Download", icon: DownloadIcon },
  { label: "Reports", icon: FileTextIcon },
  { label: "Messages", icon: MessageSquareIcon },
  { label: "Orders", icon: ShoppingCartIcon },
  { label: "Database", icon: DatabaseIcon },
  { label: "Settings", icon: SettingsIcon },
]

export default function WidgetsPage() {
  return (
    <div className="flex flex-col gap-8 p-6 pb-12">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Widgets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A gallery of reusable dashboard widgets — stats, activity, weather, and more.
        </p>
      </div>

      {/* ── KPI row ── */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          KPI Stats
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value="$48,295"
            delta="+12.4% vs last month"
            trend="up"
            icon={CreditCardIcon}
          />
          <KpiCard
            label="Active Users"
            value="3,841"
            delta="+5.7% vs last week"
            trend="up"
            icon={UsersIcon}
          />
          <KpiCard
            label="Churn Rate"
            value="2.3%"
            delta="+0.4% this month"
            trend="down"
            icon={TrendingUpIcon}
          />
          <KpiCard
            label="New Orders"
            value="1,204"
            delta="+8.1% vs yesterday"
            trend="up"
            icon={ShoppingCartIcon}
          />
        </div>
      </div>

      {/* ── Widgets grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* ── Goal / Progress widget ── */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Goal</CardTitle>
            <CardDescription>Revenue target progress</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Radial-style visual using concentric ring */}
            <div className="flex items-center justify-center py-2">
              <div className="relative flex size-28 items-center justify-center">
                <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-muted"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40 * 0.74} ${2 * Math.PI * 40}`}
                    className="stroke-primary transition-all"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums">74%</span>
                  <span className="text-xs text-muted-foreground">of goal</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Progress value={74}>
                <ProgressLabel>Revenue</ProgressLabel>
                <ProgressValue>{() => "$48.3K / $65K"}</ProgressValue>
              </Progress>
              <Progress value={58}>
                <ProgressLabel>Deals closed</ProgressLabel>
                <ProgressValue>{() => "58 / 100"}</ProgressValue>
              </Progress>
            </div>
          </CardContent>
        </Card>

        {/* ── Recent Activity ── */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions by your team</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {ACTIVITY_ITEMS.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <li className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${item.color}`}
                    >
                      {item.initials}
                    </span>
                    <div className="flex-1 leading-snug">
                      <p className="text-sm">
                        <span className="font-medium">{item.user}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </li>
                  {idx < ACTIVITY_ITEMS.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Weather widget ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Weather
              <Badge variant="outline">Seoul, KR</Badge>
            </CardTitle>
            <CardDescription>Saturday, June 7, 2026</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CloudIcon className="size-12 text-sky-400" />
                <div>
                  <p className="text-4xl font-bold tabular-nums">23°C</p>
                  <p className="text-sm text-muted-foreground">Partly cloudy</p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Humidity 62%</p>
                <p>Wind 14 km/h</p>
                <p>UV index 4</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              {[
                { day: "Sun", icon: "☀️", hi: 25, lo: 18 },
                { day: "Mon", icon: "⛅", hi: 22, lo: 16 },
                { day: "Tue", icon: "🌧️", hi: 19, lo: 14 },
                { day: "Wed", icon: "🌤️", hi: 21, lo: 15 },
                { day: "Thu", icon: "☀️", hi: 26, lo: 19 },
              ].map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-0.5">
                  <span className="text-muted-foreground">{d.day}</span>
                  <span className="text-base leading-none">{d.icon}</span>
                  <span className="font-medium">{d.hi}°</span>
                  <span className="text-muted-foreground">{d.lo}°</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Upcoming / Calendar widget ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CalendarIcon className="size-4" />
              Upcoming
            </CardTitle>
            <CardDescription>Your next scheduled events</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {UPCOMING_EVENTS.map((ev, idx) => (
                <React.Fragment key={ev.id}>
                  <li className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-snug">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev.date}</p>
                    </div>
                    {ev.badge && (
                      <Badge variant={ev.badge === "Important" ? "destructive" : "default"} className="shrink-0">
                        {ev.badge}
                      </Badge>
                    )}
                  </li>
                  {idx < UPCOMING_EVENTS.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Storage widget ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <HardDriveIcon className="size-4" />
              Storage
            </CardTitle>
            <CardDescription>36.8 GB used of 100 GB</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Composite bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {STORAGE_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className={`${item.color} h-full transition-all`}
                  style={{ width: `${item.value}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {STORAGE_ITEMS.map((item) => (
                <li key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-muted-foreground">{item.value}%</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <UploadIcon />
                Upload
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <DatabaseIcon />
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Team / Online widget ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <UsersIcon className="size-4" />
              Team
            </CardTitle>
            <CardDescription>Members currently active</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <AvatarGroup>
                {TEAM_MEMBERS.map((m) => (
                  <Avatar key={m.initials}>
                    <AvatarFallback>{m.initials}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <Badge variant="default" className="gap-1">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                5 online
              </Badge>
            </div>
            <Separator />
            <ul className="flex flex-col gap-3">
              {TEAM_MEMBERS.map((m, idx) => (
                <React.Fragment key={m.initials}>
                  <li className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback>{m.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium leading-none">{m.label}</p>
                        <p className="text-xs text-muted-foreground">Active now</p>
                      </div>
                    </div>
                    <span className="size-2 rounded-full bg-emerald-400" />
                  </li>
                  {idx < TEAM_MEMBERS.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Quick Actions widget ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <ZapIcon className="size-4" />
              Quick Actions
            </CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-3 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── System Status widget ── */}
        <Card className="col-span-1 sm:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <ActivityIcon className="size-4" />
              System Status
            </CardTitle>
            <CardDescription>Resource utilization at a glance</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: "CPU Usage", value: 62, color: "bg-violet-500" },
                { label: "Memory", value: 78, color: "bg-sky-500" },
                { label: "Disk I/O", value: 44, color: "bg-amber-500" },
                { label: "Network", value: 31, color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="tabular-nums text-muted-foreground">{item.value}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {[
                { label: "API", status: "Operational" },
                { label: "DB", status: "Operational" },
                { label: "CDN", status: "Degraded" },
                { label: "Auth", status: "Operational" },
              ].map((svc) => (
                <div key={svc.label} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs">
                  <span
                    className={`size-1.5 rounded-full ${svc.status === "Operational" ? "bg-emerald-400" : "bg-amber-400"}`}
                  />
                  <span className="font-medium">{svc.label}</span>
                  <span className="text-muted-foreground">{svc.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
