# Onboarding + Users Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two production-quality shadcn-style dashboard pages — a 4-step onboarding wizard and a TanStack data-table users list — replacing placeholder pages.

**Architecture:** Each page is a single client component in `src/components/pages/<name>/`. The `page.tsx` in the dashboard route simply re-exports the component. The users page splits static fixture data into a `data.ts` sidecar so the component stays focused on rendering. Both pages wire local state only — no server calls.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Base UI (via shadcn wrappers in `src/components/ui/`), `@tanstack/react-table` v8, lucide-react.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/components/pages/onboarding/onboarding-page.tsx` | 4-step wizard UI + local step state |
| Create | `src/components/pages/users/data.ts` | Static user fixtures + TypeScript types |
| Create | `src/components/pages/users/users-page.tsx` | TanStack table with search/select/pagination |
| Modify | `src/app/(dashboard)/onboarding/page.tsx` | Replace placeholder with OnboardingPage |
| Modify | `src/app/(dashboard)/users/page.tsx` | Replace placeholder with UsersPage |

---

## Task 1: Onboarding wizard component

**Files:**
- Create: `src/components/pages/onboarding/onboarding-page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "/Volumes/MacExtend 1/SDTPL_ADM/src/components/pages/onboarding"
```

- [ ] **Step 2: Write `onboarding-page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Check, ArrowRight, ArrowLeft, User, Building, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Your Profile" },
  { id: 3, label: "Preferences" },
  { id: 4, label: "Done" },
];

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepId }) {
  return (
    <div className="space-y-3">
      <Progress value={((current - 1) / (STEPS.length - 1)) * 100} />
      <div className="flex justify-between">
        {STEPS.map(({ id, label }) => {
          const done = id < current;
          const active = id === current;
          return (
            <div key={id} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : id}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <User className="size-9 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Welcome to the platform</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;ll walk you through a quick setup so you can get the most out of
          your workspace. It only takes a minute.
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-3 gap-3 text-left">
        {[
          { icon: User, label: "Set up your profile" },
          { icon: Bell, label: "Choose notifications" },
          { icon: Building, label: "Pick your plan" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-lg border bg-muted/40 p-3 text-center"
          >
            <Icon className="size-5 text-primary" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Your Profile ────────────────────────────────────────────────────

interface ProfileState {
  name: string;
  company: string;
  role: string;
  avatar: string;
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function StepProfile({
  profile,
  onChange,
}: {
  profile: ProfileState;
  onChange: (p: ProfileState) => void;
}) {
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <Avatar size="lg" className={cn("size-16", profile.avatar || AVATAR_COLORS[0])}>
          <AvatarFallback className="text-lg text-white">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex gap-1.5">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...profile, avatar: color })}
              className={cn(
                "size-5 rounded-full border-2 transition-all",
                color,
                profile.avatar === color
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              aria-label={`Select ${color} avatar`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-name">Full name</Label>
          <Input
            id="onboarding-name"
            placeholder="Sofia Davis"
            value={profile.name}
            onChange={(e) => onChange({ ...profile, name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-company">Company</Label>
          <Input
            id="onboarding-company"
            placeholder="Acme Inc."
            value={profile.company}
            onChange={(e) => onChange({ ...profile, company: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-role">Role</Label>
          <Select
            value={profile.role}
            onValueChange={(v) => onChange({ ...profile, role: v })}
          >
            <SelectTrigger id="onboarding-role" className="w-full">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engineer">Engineer</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
              <SelectItem value="product">Product Manager</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Preferences ─────────────────────────────────────────────────────

interface PrefsState {
  emailDigest: boolean;
  productUpdates: boolean;
  securityAlerts: boolean;
  plan: string;
}

function StepPreferences({
  prefs,
  onChange,
}: {
  prefs: PrefsState;
  onChange: (p: PrefsState) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium">Notifications</p>
        {(
          [
            { key: "emailDigest", label: "Weekly email digest", desc: "Get a summary of activity every Monday" },
            { key: "productUpdates", label: "Product updates", desc: "New features and improvements" },
            { key: "securityAlerts", label: "Security alerts", desc: "Immediately notify on suspicious activity" },
          ] as const
        ).map(({ key, label, desc }) => (
          <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id={`pref-${key}`}
              checked={prefs[key]}
              onCheckedChange={(v) => onChange({ ...prefs, [key]: !!v })}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`pref-${key}`} className="cursor-pointer font-medium">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-plan">Plan</Label>
        <Select
          value={prefs.plan}
          onValueChange={(v) => onChange({ ...prefs, plan: v })}
        >
          <SelectTrigger id="onboarding-plan" className="w-full">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free — up to 3 projects</SelectItem>
            <SelectItem value="pro">Pro — $12/mo, unlimited projects</SelectItem>
            <SelectItem value="team">Team — $49/mo, collaboration tools</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <Check className="size-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your workspace is ready. You can always update your profile and
          notification preferences in Settings.
        </p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState<StepId>(1);
  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    company: "",
    role: "",
    avatar: AVATAR_COLORS[0],
  });
  const [prefs, setPrefs] = useState<PrefsState>({
    emailDigest: true,
    productUpdates: false,
    securityAlerts: true,
    plan: "free",
  });

  const isLast = step === 4;
  const isFirst = step === 1;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-2">
          <CardTitle>Get started</CardTitle>
          <CardDescription>Step {step} of {STEPS.length}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Stepper current={step} />

          {step === 1 && <StepWelcome />}
          {step === 2 && (
            <StepProfile profile={profile} onChange={setProfile} />
          )}
          {step === 3 && (
            <StepPreferences prefs={prefs} onChange={setPrefs} />
          )}
          {step === 4 && <StepDone />}
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s - 1) as StepId)}
            disabled={isFirst}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {isLast ? (
            <Button onClick={() => (window.location.href = "/dashboard")}>
              Go to Dashboard
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => (s + 1) as StepId)}>
              {step === 3 ? "Finish" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles for this file**

```bash
cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `onboarding-page.tsx`.

---

## Task 2: Users data fixtures

**Files:**
- Create: `src/components/pages/users/data.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "/Volumes/MacExtend 1/SDTPL_ADM/src/components/pages/users"
```

- [ ] **Step 2: Write `data.ts`**

```ts
export type UserRole = "Admin" | "Editor" | "Viewer";
export type UserStatus = "Active" | "Invited" | "Suspended";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string; // ISO date string, e.g. "2026-05-20"
  initials: string;
}

export const USERS: User[] = [
  { id: "u1",  name: "Sofia Davis",      email: "sofia@example.com",    role: "Admin",  status: "Active",    lastActive: "2026-06-06", initials: "SD" },
  { id: "u2",  name: "Jackson Lee",      email: "jackson@example.com",  role: "Editor", status: "Active",    lastActive: "2026-06-05", initials: "JL" },
  { id: "u3",  name: "Isabella Nguyen",  email: "isabella@example.com", role: "Viewer", status: "Invited",   lastActive: "2026-05-30", initials: "IN" },
  { id: "u4",  name: "Olivia Martin",    email: "olivia@example.com",   role: "Admin",  status: "Active",    lastActive: "2026-06-04", initials: "OM" },
  { id: "u5",  name: "Liam Garcia",      email: "liam@example.com",     role: "Editor", status: "Active",    lastActive: "2026-06-01", initials: "LG" },
  { id: "u6",  name: "Emma Brown",       email: "emma@example.com",     role: "Viewer", status: "Suspended", lastActive: "2026-04-15", initials: "EB" },
  { id: "u7",  name: "Noah Wilson",      email: "noah@example.com",     role: "Viewer", status: "Active",    lastActive: "2026-05-28", initials: "NW" },
  { id: "u8",  name: "Ava Thompson",     email: "ava@example.com",      role: "Editor", status: "Invited",   lastActive: "2026-06-03", initials: "AT" },
  { id: "u9",  name: "James Anderson",   email: "james@example.com",    role: "Viewer", status: "Active",    lastActive: "2026-06-02", initials: "JA" },
  { id: "u10", name: "Charlotte Harris", email: "charlotte@example.com",role: "Editor", status: "Active",    lastActive: "2026-06-05", initials: "CH" },
  { id: "u11", name: "Elijah Martinez",  email: "elijah@example.com",   role: "Admin",  status: "Suspended", lastActive: "2026-03-10", initials: "EM" },
  { id: "u12", name: "Amelia Robinson",  email: "amelia@example.com",   role: "Viewer", status: "Invited",   lastActive: "2026-05-25", initials: "AR" },
];
```

---

## Task 3: Users page component

**Files:**
- Create: `src/components/pages/users/users-page.tsx`

- [ ] **Step 1: Write `users-page.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USERS, type User, type UserRole } from "./data";

// ─── Badge styles ─────────────────────────────────────────────────────────────

const roleClass: Record<UserRole, string> = {
  Admin:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Editor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Viewer: "bg-secondary text-secondary-foreground",
};

const statusClass: Record<User["status"], string> = {
  Active:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Invited:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Suspended: "bg-red-500/15 text-red-600 dark:text-red-400",
};

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() &&
          !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    size: 40,
  },
  {
    id: "user",
    accessorFn: (row) => `${row.name} ${row.email}`,
    header: "User",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{u.initials}</AvatarFallback>
          </Avatar>
          <div className="grid leading-tight">
            <span className="font-medium">{u.name}</span>
            <span className="text-xs text-muted-foreground">{u.email}</span>
          </div>
        </div>
      );
    },
    filterFn: (row, _id, filterValue: string) => {
      const v = filterValue.toLowerCase();
      return (
        row.original.name.toLowerCase().includes(v) ||
        row.original.email.toLowerCase().includes(v)
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue<UserRole>("role");
      return (
        <Badge className={cn("border-transparent", roleClass[role])}>
          {role}
        </Badge>
      );
    },
    filterFn: (row, _id, filterValue: string) =>
      filterValue === "all" || row.original.role === filterValue,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.getValue<User["status"]>("status");
      return (
        <Badge className={cn("border-transparent", statusClass[s])}>{s}</Badge>
      );
    },
  },
  {
    accessorKey: "lastActive",
    header: "Last active",
    cell: ({ row }) => {
      const iso = row.getValue<string>("lastActive");
      // Format as "Jun 6, 2026" — deterministic from ISO string, safe in render
      const [year, month, day] = iso.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return (
        <span className="text-muted-foreground">
          {d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{u.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Suspend</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    size: 48,
  },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const filteredData = useMemo(() => {
    const q = globalFilter.toLowerCase();
    return USERS.filter((u) => {
      const matchesSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [globalFilter, roleFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their account permissions.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add User
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "Admin", "Editor", "Viewer"] as const).map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(r)}
            >
              {r === "all" ? "All" : r}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.column.columnDef.size }}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {filteredData.length} row(s) selected.
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors in users files.

---

## Task 4: Wire page.tsx routes

**Files:**
- Modify: `src/app/(dashboard)/onboarding/page.tsx`
- Modify: `src/app/(dashboard)/users/page.tsx`

- [ ] **Step 1: Replace onboarding page.tsx**

New content for `src/app/(dashboard)/onboarding/page.tsx`:

```tsx
import { OnboardingPage } from "@/components/pages/onboarding/onboarding-page";

export default function POnboardingPage() {
  return <OnboardingPage />;
}
```

- [ ] **Step 2: Replace users page.tsx**

New content for `src/app/(dashboard)/users/page.tsx`:

```tsx
import { UsersPage } from "@/components/pages/users/users-page";

export default function PUsersListPage() {
  return <UsersPage />;
}
```

---

## Task 5: Build verification + commit

**Files:** No new files.

- [ ] **Step 1: Run TypeScript check**

```bash
cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm exec tsc --noEmit 2>&1
```

Expected: `exit code 0`, no output.

- [ ] **Step 2: Run production build**

```bash
cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm build 2>&1 | tail -30
```

Expected: build succeeds and output lists `/onboarding` and `/users` in the route tree.

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/SDTPL_ADM" && git add \
  src/components/pages/onboarding/onboarding-page.tsx \
  src/components/pages/users/data.ts \
  src/components/pages/users/users-page.tsx \
  src/app/\(dashboard\)/onboarding/page.tsx \
  src/app/\(dashboard\)/users/page.tsx && \
git commit -m "feat: add onboarding + users pages"
```

---

## Self-review notes

- Spec: 4-step wizard with stepper/progress at top — covered via `<Stepper>` + `<Progress>` in Task 1.
- Spec: Step 1 Welcome illustration placeholder — covered with icon-in-circle.
- Spec: Step 2 avatar pick — covered via color swatches in `StepProfile`.
- Spec: Step 3 checkboxes + plan select — covered in `StepPreferences`.
- Spec: Step 4 Done with "Go to Dashboard" — covered in `StepDone` + conditional button.
- Spec: Back/Next/Finish footer buttons — covered, disabled on first/last as appropriate.
- Spec: Users select checkbox (header indeterminate + row) — Base UI pattern from payments-table, copied exactly.
- Spec: Role badge / Status colored badge — covered via `roleClass`/`statusClass` maps.
- Spec: Search filter by name/email — covered via `useMemo` filter + globalFilter state.
- Spec: `DropdownMenuTrigger` uses `render` prop — confirmed in Task 3.
- Spec: No `Math.random()` or argless `new Date()` in render — `lastActive` dates are deterministic ISO strings parsed safely.
- Spec: `@tanstack/react-table` v8 installed — used.
- Spec: page size 8 — set in `initialState`.
- Type consistency: `UserRole`, `UserStatus`, `User` defined in `data.ts` and imported in `users-page.tsx` — consistent.
- `AVATAR_COLORS` constant defined before `StepProfile` uses it — consistent.
