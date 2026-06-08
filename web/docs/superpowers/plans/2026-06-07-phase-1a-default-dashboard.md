# Phase 1a — Default Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the `/dashboard/default` placeholder with a faithful clone of the shadcnuikit Default dashboard — page header (date-range picker + Download) and 7 widgets (Subscriptions, Total Revenue, Team Members, New Message chat, Exercise Minutes chart, Latest Payments table, Payment Method form).

**Architecture:** Each widget is a focused component under `src/components/dashboards/default/`. The page (`(dashboard)/dashboard/default/page.tsx`) composes them in a responsive grid. Mock data lives in `src/lib/data.ts`. Charts use shadcn's `chart` (Recharts) components; the payments table uses TanStack Table. Widgets needing interactivity are client components.

**Tech Stack:** Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (Base UI) · Recharts (via shadcn `chart`) · @tanstack/react-table · lucide-react.

**Reference:** Spec [docs/superpowers/specs/2026-06-07-phase-1-dashboards-design.md](../specs/2026-06-07-phase-1-dashboards-design.md). Live: https://shadcnuikit.com/dashboard/default.

**Base UI reminders (from Phase 0):** triggers use the `render` prop (NOT `asChild`); the generated `CommandDialog` lacks a `<Command>` root; verify each generated component's API before consuming it. Playwright `webServer` runs the PROD build. `pnpm lint` runs separately from `pnpm build`.

---

## File Structure (this phase)

```
src/
  components/dashboards/default/
    metric-cards.tsx        # Subscriptions + Total Revenue (mini charts)
    team-members.tsx        # Team Members list + role dropdown
    chat-card.tsx           # "New Message" chat (Sofia Davis)
    exercise-card.tsx       # Exercise Minutes line chart + Export
    payments-table.tsx      # Latest Payments — TanStack table
    payment-method.tsx      # Payment Method form
    dashboard-header.tsx    # title + date-range picker + Download
  app/(dashboard)/dashboard/default/page.tsx   # assembles the grid
  lib/data.ts               # extended mock data
e2e/dashboard-default.spec.ts   # widget smoke tests
```

---

## Task 1: Add chart + supporting shadcn components

**Files:** `src/components/ui/chart.tsx`, `calendar.tsx`, `select.tsx`, `checkbox.tsx`, `progress.tsx` (CLI-generated); `package.json` (recharts, @tanstack/react-table).

- [ ] **Step 1: Add shadcn components**

```bash
pnpm dlx shadcn@latest add --yes chart calendar select checkbox progress
```
Expected: files appear under `src/components/ui/`. `chart` installs `recharts`.

- [ ] **Step 2: Install TanStack Table**

```bash
pnpm add @tanstack/react-table
```

- [ ] **Step 3: Verify build + type-check**

```bash
pnpm exec tsc --noEmit && pnpm build
```
Expected: success. (If `chart` did not pull `recharts`, run `pnpm add recharts`.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add chart/calendar/select/checkbox/progress + tanstack-table"
```

---

## Task 2: Extend mock data (`src/lib/data.ts`)

**Files:** Modify `src/lib/data.ts` (keep existing exports; ADD the below).

- [ ] **Step 1: Append the new types + data to `src/lib/data.ts`** (do not remove existing `TeamMember`/`Payment`/`Notification`/`teamMembers`/`latestPayments`/`notifications`; UPDATE `teamMembers` to 4 entries with roles and EXPAND `latestPayments` to 9 rows as shown)

Replace the existing `teamMembers` and `latestPayments` exports and append the rest:

```ts
export type TeamRole = "Owner" | "Member" | "Viewer" | "Developer" | "Billing";
export type TeamMemberWithRole = TeamMember & { role: TeamRole };

export const teamMembers: TeamMemberWithRole[] = [
  { name: "Sofia Davis", email: "m@example.com", role: "Owner" },
  { name: "Jackson Lee", email: "p@example.com", role: "Developer" },
  { name: "Isabella Nguyen", email: "i@example.com", role: "Viewer" },
  { name: "Olivia Martin", email: "o@example.com", role: "Billing" },
];

export const latestPayments: Payment[] = [
  { id: "m5gr84i9", customer: "Ken Russell", email: "ken99@example.com", amount: 316, status: "success" },
  { id: "3u1reuv4", customer: "Abe Davis", email: "abe45@example.com", amount: 242, status: "success" },
  { id: "derv1ws0", customer: "Monserrat Lang", email: "monserrat44@example.com", amount: 837, status: "processing" },
  { id: "5kma53ae", customer: "Silas Mendoza", email: "silas22@example.com", amount: 874, status: "success" },
  { id: "bhqecj4p", customer: "Carmella Johnson", email: "carmella@example.com", amount: 721, status: "failed" },
  { id: "p0r2f11x", customer: "Jason Wu", email: "jason.wu@example.com", amount: 459, status: "processing" },
  { id: "n3v8sd2c", customer: "Emma Brown", email: "emma.b@example.com", amount: 638, status: "success" },
  { id: "k9f3la7q", customer: "Liam Garcia", email: "liam.g@example.com", amount: 192, status: "failed" },
  { id: "z2x7cv1m", customer: "Noah Wilson", email: "noah.w@example.com", amount: 545, status: "success" },
];

// Subscriptions metric mini bar chart (12 months)
export const subscriptionsSeries = [
  { month: "Jan", value: 1200 }, { month: "Feb", value: 2100 }, { month: "Mar", value: 800 },
  { month: "Apr", value: 1600 }, { month: "May", value: 900 }, { month: "Jun", value: 1700 },
  { month: "Jul", value: 2400 }, { month: "Aug", value: 1300 }, { month: "Sep", value: 2200 },
  { month: "Oct", value: 1900 }, { month: "Nov", value: 2600 }, { month: "Dec", value: 4850 },
];

// Total Revenue metric mini area chart (12 months)
export const revenueSeries = [
  { month: "Jan", value: 4200 }, { month: "Feb", value: 5100 }, { month: "Mar", value: 4800 },
  { month: "Apr", value: 6100 }, { month: "May", value: 7300 }, { month: "Jun", value: 6900 },
  { month: "Jul", value: 8200 }, { month: "Aug", value: 9100 }, { month: "Sep", value: 10300 },
  { month: "Oct", value: 11900 }, { month: "Nov", value: 13600 }, { month: "Dec", value: 15231 },
];

// Exercise Minutes — this month vs average (line chart)
export const exerciseSeries = [
  { day: "Mon", thisMonth: 62, average: 45 }, { day: "Tue", thisMonth: 50, average: 48 },
  { day: "Wed", thisMonth: 73, average: 52 }, { day: "Thu", thisMonth: 80, average: 55 },
  { day: "Fri", thisMonth: 68, average: 60 }, { day: "Sat", thisMonth: 95, average: 70 },
  { day: "Sun", thisMonth: 88, average: 66 },
];

export type ChatMessage = { from: "them" | "me"; content: string };
export const chatMessages: ChatMessage[] = [
  { from: "them", content: "Hi, how can I help you today?" },
  { from: "me", content: "Hey, I'm having trouble with my account." },
  { from: "them", content: "What seems to be the problem?" },
  { from: "me", content: "I can't log in." },
];

export const chatContact = { name: "Sofia Davis", email: "m@example.com" };

// Date range shown in the header (faithful to the reference; display-only)
export const dashboardDateRange = "10 May 2026 - 06 Jun 2026";
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/data.ts
git commit -m "feat: extend mock data for default dashboard widgets"
```
Note: existing imports of `teamMembers` (Phase 0 had no role usage) and `latestPayments` still resolve; the smoke suite must still pass — verify in Task 10.

---

## Task 3: Metric cards — Subscriptions + Total Revenue

**Files:** Create `src/components/dashboards/default/metric-cards.tsx`.

Two `Card`s, each with a label, big value, percentage delta (muted text), and a small chart at the bottom. Subscriptions = mini **bar** chart over `subscriptionsSeries`; Total Revenue = mini **area** chart over `revenueSeries`.

- [ ] **Step 1: Read the generated chart API**

Open `src/components/ui/chart.tsx` and confirm the exports: `ChartContainer`, `ChartConfig`, `ChartTooltip`, `ChartTooltipContent`. Note how `ChartContainer` is used (it takes a `config` prop and wraps a Recharts chart as its single child). Build the charts to match that API.

- [ ] **Step 2: Implement `metric-cards.tsx`** (client component — Recharts needs the client)

```tsx
"use client";

import { Bar, BarChart, Area, AreaChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { subscriptionsSeries, revenueSeries } from "@/lib/data";

const subsConfig = { value: { label: "Subscriptions", color: "var(--chart-1)" } } satisfies ChartConfig;
const revConfig = { value: { label: "Revenue", color: "var(--chart-2)" } } satisfies ChartConfig;

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
            <Area dataKey="value" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```
> If `ChartContainer`/`ChartConfig` differ from the above (e.g. different prop names), ADAPT to the actual generated API; keep two cards with the same content + a bar and an area mini-chart. The `--color-value` CSS var is provided by `ChartContainer` from the `config` key.

- [ ] **Step 3: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/metric-cards.tsx
git commit -m "feat: add subscriptions + total revenue metric cards"
```

---

## Task 4: Team Members card

**Files:** Create `src/components/dashboards/default/team-members.tsx`.

- [ ] **Step 1: Implement** (client — role dropdown is interactive). Use `Card`, `Avatar`, and a `DropdownMenu` for the role. Confirm `DropdownMenuTrigger` uses the Base UI `render` prop.

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { teamMembers, type TeamRole } from "@/lib/data";

const ROLES: TeamRole[] = ["Owner", "Member", "Viewer", "Developer", "Billing"];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function TeamMembersCard() {
  const [roles, setRoles] = useState<Record<string, TeamRole>>(
    Object.fromEntries(teamMembers.map((m) => [m.email, m.role]))
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Invite your team members to collaborate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {teamMembers.map((m) => (
          <div key={m.email} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9"><AvatarFallback>{initials(m.name)}</AvatarFallback></Avatar>
              <div className="text-sm">
                <p className="font-medium leading-none">{m.name}</p>
                <p className="text-muted-foreground">{m.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1">
                    {roles[m.email]} <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {ROLES.map((r) => (
                  <DropdownMenuItem key={r} onClick={() => setRoles((s) => ({ ...s, [m.email]: r }))}>
                    {r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/team-members.tsx
git commit -m "feat: add team members card"
```

---

## Task 5: New Message chat card

**Files:** Create `src/components/dashboards/default/chat-card.tsx`.

- [ ] **Step 1: Implement** (client — local message state). Header with avatar + Sofia Davis + a "+" button; message bubbles (theirs = `bg-muted`, mine = `bg-primary text-primary-foreground`, right-aligned); footer with an `Input` + send `Button`. Submitting appends a "me" message locally.

```tsx
"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chatMessages as initial, chatContact, type ChatMessage } from "@/lib/data";

export function ChatCard() {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "me", content: text.trim() }]);
    setText("");
  }
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center gap-3 border-b">
        <Avatar className="size-9"><AvatarFallback>SD</AvatarFallback></Avatar>
        <div className="flex-1 text-sm">
          <p className="font-medium leading-none">{chatContact.name}</p>
          <p className="text-muted-foreground">{chatContact.email}</p>
        </div>
        <Button variant="outline" size="icon" className="size-8" aria-label="New message">
          <Plus className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[75%] rounded-lg px-3 py-2 text-sm",
              m.from === "me" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {m.content}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <form onSubmit={send} className="flex w-full items-center gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message..." />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/chat-card.tsx
git commit -m "feat: add new message chat card"
```

---

## Task 6: Exercise Minutes chart card

**Files:** Create `src/components/dashboards/default/exercise-card.tsx`.

- [ ] **Step 1: Implement** (client — Recharts). Line chart of `exerciseSeries` with two lines (`thisMonth`, `average`); title "Exercise Minutes", description, and an "Export" button in the header (right). Verify the chart API against `src/components/ui/chart.tsx` (use `ChartContainer` + `ChartTooltip`/`ChartTooltipContent`).

```tsx
"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { Card, CardAction, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
```
> If `CardAction` is not an export of the generated `card.tsx`, place the Export button in the header via a flex row instead. Verify against `src/components/ui/card.tsx`.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/exercise-card.tsx
git commit -m "feat: add exercise minutes chart card"
```

---

## Task 7: Latest Payments — TanStack data table

**Files:** Create `src/components/dashboards/default/payments-table.tsx`.

A faithful clone of the shadcn "payments" data-table demo. Features: row-selection checkboxes (header select-all + per-row), columns **Customer**, **Email**, **Amount** (right-aligned currency), **Status** (badge), and a per-row actions `⋯` dropdown; a top toolbar with an email filter `Input` and a "Columns" visibility dropdown; a footer with "N of M row(s) selected." and Previous/Next pagination.

- [ ] **Step 1: Implement** (client). Use `@tanstack/react-table` (`useReactTable`, `getCoreRowModel`, `getFilteredRowModel`, `getPaginationRowModel`, `getSortedRowModel`, `flexRender`), shadcn `Table`, `Checkbox`, `Input`, `Button`, `Badge`, `DropdownMenu`. Verify `Checkbox` uses Base UI (`checked` + `onCheckedChange`, and an `indeterminate` prop for the header select-all). Confirm `DropdownMenuCheckboxItem` API for the columns toggle.

```tsx
"use client";

import * as React from "react";
import {
  type ColumnDef, type SortingState, type ColumnFiltersState, type VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { latestPayments, type Payment } from "@/lib/data";

const statusVariant: Record<Payment["status"], string> = {
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  processing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const columns: ColumnDef<Payment>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
    ),
    enableSorting: false,
  },
  { accessorKey: "customer", header: "Customer", cell: ({ row }) => <span className="font-medium">{row.getValue("customer")}</span> },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Email <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.getValue("status") as Payment["status"];
      return <Badge variant="secondary" className={statusVariant[s]}>{s}</Badge>;
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
      return <div className="text-right font-medium tabular-nums">{formatted}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>} />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>Copy payment ID</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View customer</DropdownMenuItem>
          <DropdownMenuItem>View payment details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export function PaymentsTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data: latestPayments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 5 } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 pb-4">
          <Input
            placeholder="Filter emails..."
            value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("email")?.setFilterValue(e.target.value)}
            className="max-w-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="ml-auto gap-1">Columns <ChevronDown className="size-4" /></Button>} />
            <DropdownMenuContent align="end">
              {table.getAllColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} className="capitalize">
                  {c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```
> Verify the generated `Checkbox` accepts `checked` (incl. the string `"indeterminate"`) and `onCheckedChange`. If its API differs (e.g. a separate `indeterminate` boolean prop — a known Base UI pattern), adapt the header checkbox accordingly. Verify `DropdownMenuCheckboxItem` `checked`/`onCheckedChange`.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/payments-table.tsx
git commit -m "feat: add latest payments tanstack table"
```

---

## Task 8: Payment Method form card

**Files:** Create `src/components/dashboards/default/payment-method.tsx`.

- [ ] **Step 1: Implement** (client — selected method state). Card "Payment Method" + description; a 3-way method toggle (Card / Paypal / Apple) rendered as selectable bordered buttons with an icon; fields: Name on card (`Input`), City (`Input`), Card number (`Input`), Expires (Month `Select` + Year `Select`), CVC (`Input`); a full-width "Continue" `Button`. Verify the generated `Select` API (Base UI: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`).

```tsx
"use client";

import { useState } from "react";
import { CreditCard, Wallet, Apple } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "card", label: "Card", icon: CreditCard },
  { id: "paypal", label: "Paypal", icon: Wallet },
  { id: "apple", label: "Apple", icon: Apple },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = ["2026","2027","2028","2029","2030"];

export function PaymentMethodCard() {
  const [method, setMethod] = useState("card");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Add a new payment method to your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border-2 bg-popover p-4 text-sm hover:bg-accent hover:text-accent-foreground",
                method === m.id ? "border-primary" : "border-muted"
              )}
            >
              <m.icon className="size-5" />
              {m.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-name">Name on card</Label>
          <Input id="pm-name" placeholder="First Last" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-city">City</Label>
          <Input id="pm-city" placeholder="City" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-number">Card number</Label>
          <Input id="pm-number" placeholder="1234 5678 9012 3456" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label>Expires</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Year</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pm-cvc">CVC</Label>
            <Input id="pm-cvc" placeholder="CVC" />
          </div>
        </div>
        <Button className="w-full">Continue</Button>
      </CardContent>
    </Card>
  );
}
```
> Verify the generated `Select` exports/usage; adapt if the Base UI Select API differs (e.g. `SelectValue` placeholder handling). Keep all fields + the Continue button.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/payment-method.tsx
git commit -m "feat: add payment method form card"
```

---

## Task 9: Dashboard header (title + date-range picker + Download)

**Files:** Create `src/components/dashboards/default/dashboard-header.tsx`.

- [ ] **Step 1: Implement** (client — popover open state). Left: `<h1>Dashboard</h1>`. Right: a date-range button (calendar icon + `dashboardDateRange` text) that opens a `Popover` containing a `Calendar` in range mode (display-only is fine; wiring selection to state is optional), and an outline "Download" button with a download icon. Verify `Popover`/`Calendar` APIs; `PopoverTrigger` uses the `render` prop.

```tsx
"use client";

import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dashboardDateRange } from "@/lib/data";

export function DashboardHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="gap-2">
                <CalendarDays className="size-4" />
                {dashboardDateRange}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="range" numberOfMonths={2} />
          </PopoverContent>
        </Popover>
        <Button className="gap-2">
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
```
> Verify the generated `Calendar` accepts `mode="range"` and `numberOfMonths`. If the API differs, render a single-month `Calendar` inside the popover — the key faithful elements are the date-range button text + the Download button.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/components/dashboards/default/dashboard-header.tsx
git commit -m "feat: add dashboard header with date-range picker"
```

---

## Task 10: Assemble the Default dashboard page

**Files:** Modify `src/app/(dashboard)/dashboard/default/page.tsx`.

- [ ] **Step 1: Compose the widgets in a responsive grid**

```tsx
import { DashboardHeader } from "@/components/dashboards/default/dashboard-header";
import { SubscriptionsCard, TotalRevenueCard } from "@/components/dashboards/default/metric-cards";
import { TeamMembersCard } from "@/components/dashboards/default/team-members";
import { ChatCard } from "@/components/dashboards/default/chat-card";
import { ExerciseCard } from "@/components/dashboards/default/exercise-card";
import { PaymentsTable } from "@/components/dashboards/default/payments-table";
import { PaymentMethodCard } from "@/components/dashboards/default/payment-method";

export default function DefaultDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SubscriptionsCard />
        <TotalRevenueCard />
        <TeamMembersCard />
        <ChatCard />
        <ExerciseCard />
        <PaymentMethodCard />
        <div className="lg:col-span-2 xl:col-span-3">
          <PaymentsTable />
        </div>
      </div>
    </div>
  );
}
```
> This is a reasonable faithful arrangement; adjust `col-span`s if a widget reads better wider. The page stays a server component (each interactive widget is its own `"use client"` component).

- [ ] **Step 2: Build + type-check**

```bash
pnpm exec tsc --noEmit && pnpm build
```
Expected: success; `/dashboard/default` compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/"(dashboard)"/dashboard/default/page.tsx
git commit -m "feat: assemble default dashboard page"
```

---

## Task 11: Widget smoke tests + full verification

**Files:** Create `e2e/dashboard-default.spec.ts`; verify the existing suite still passes.

- [ ] **Step 1: Write `e2e/dashboard-default.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("Default dashboard", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/dashboard/default"); });

  test("renders all seven widgets", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("Subscriptions")).toBeVisible();
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("+4850")).toBeVisible();
    await expect(page.getByText("$15,231.89")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team Members" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exercise Minutes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest Payments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payment Method" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  });

  test("payments table filters by email", async ({ page }) => {
    const filter = page.getByPlaceholder("Filter emails...");
    await expect(page.getByText("ken99@example.com")).toBeVisible();
    await filter.fill("monserrat");
    await expect(page.getByText("monserrat44@example.com")).toBeVisible();
    await expect(page.getByText("ken99@example.com")).not.toBeVisible();
  });

  test("chat appends a sent message", async ({ page }) => {
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Testing 123");
    await input.press("Enter");
    await expect(page.getByText("Testing 123")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the full e2e suite**

```bash
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
CI=1 pnpm exec playwright test 2>&1 | tail -20
```
Expected: all pass — the original 48 + 3 new dashboard tests = 51. The Phase 0 route-render test for `/dashboard/default` still passes (page renders content, no errors). If a chart causes an SSR/hydration error that shows up as a `pageerror` in the route-render test, fix the chart component (ensure `"use client"`), don't weaken the assertion.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```
Expected: 0 errors. Fix any real issues.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add default dashboard widget smoke tests"
```

---

## Completion Criteria

- [ ] `/dashboard/default` renders the header + 7 widgets faithfully (no placeholder).
- [ ] `pnpm build` + `pnpm lint` (0 errors) + full e2e (51 tests) green.
- [ ] Charts render without hydration errors; table filters/sorts/paginates/selects; chat appends; role + payment-method toggles work.
- [ ] No regression in the Phase 0 suite.

**Next:** user visually reviews `/dashboard/default` against the reference; then proceed to the remaining 13 dashboards (new spec/plan).

---

## Self-Review Notes
- **Spec coverage:** header+date-range+Download (Task 9 → spec §3.1), 7 widgets (Tasks 3-8 → spec §3.3), data (Task 2 → spec §3.4), charts=shadcn/Recharts + TanStack table (Tasks 1,3,6,7 → spec §2), verification (Task 11 → spec §4). All Default-dashboard spec items mapped.
- **Placeholders:** none — every widget task has full code; "verify generated API and adapt" is an instruction, not a gap (proven necessary in Phase 0 for Base UI).
- **Type consistency:** `Payment`, `TeamRole`/`teamMembers`, `ChatMessage`/`chatMessages`, the series arrays, and `dashboardDateRange` defined in Task 2 are consumed with matching names in Tasks 3-9. Component export names (`SubscriptionsCard`, `TotalRevenueCard`, `TeamMembersCard`, `ChatCard`, `ExerciseCard`, `PaymentsTable`, `PaymentMethodCard`, `DashboardHeader`) match the imports in Task 10.
