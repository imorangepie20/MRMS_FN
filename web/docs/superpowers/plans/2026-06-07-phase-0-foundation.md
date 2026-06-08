# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shared app foundation (scaffold, theme, app shell, ⌘K palette, notifications, nav config, mock-data skeleton, and stubs for every route) so all later phases can fill in real pages on a working, navigable shell.

**Architecture:** Next.js 16 App Router with two layout groups — `(dashboard)` (full app shell) and `(auth)` (bare auth layout). A single `src/lib/nav.ts` sitemap drives both the sidebar and the ⌘K command palette. Every route in the kit is created as a placeholder page in this phase so navigation works end-to-end; later phases replace placeholders with real pages. Theme is light/dark/system via `next-themes`. Verification is Playwright route-render smoke tests plus `pnpm lint`/`pnpm build`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · shadcn/ui on Base UI (`@base-ui/react`) · lucide-react · next-themes · Playwright · pnpm.

**Reference:** Spec at [docs/superpowers/specs/2026-06-07-shadcn-ui-kit-clone-design.md](../specs/2026-06-07-shadcn-ui-kit-clone-design.md). Faithful clone of https://shadcnuikit.com.

---

## File Structure (created in this phase)

```
src/
  app/
    layout.tsx                      # root: fonts + ThemeProvider
    globals.css                     # tailwind v4 + shadcn tokens (CLI-generated, theme tweaks)
    (dashboard)/
      layout.tsx                    # app shell (sidebar + header)
      dashboard/default/page.tsx    # default dashboard placeholder (Phase 1 fills real content)
      ...                           # every dashboard / app / ai / page route as placeholder
    (auth)/
      layout.tsx                    # bare centered auth layout (no shell)
      login/page.tsx ...            # auth route placeholders
    not-found.tsx                   # 404
  components/
    ui/                             # shadcn/Base UI primitives (CLI-generated)
    layout/
      app-sidebar.tsx               # sidebar built from nav.ts
      app-header.tsx                # header: breadcrumb, search trigger, theme, notifications, user
      command-palette.tsx           # ⌘K dialog built from nav.ts
      notifications.tsx             # notifications dropdown
      theme-provider.tsx            # next-themes wrapper
      theme-toggle.tsx              # light/dark/system toggle
      breadcrumbs.tsx               # derives breadcrumb from pathname + nav.ts
    placeholder-page.tsx            # reusable "coming soon" placeholder
  lib/
    nav.ts                          # full sitemap (groups → items) + types
    data.ts                         # mock data + types skeleton
    utils.ts                        # cn() (CLI-generated)
e2e/
  smoke.spec.ts                     # route render + theme + ⌘K smoke tests
playwright.config.ts
```

---

## Task 1: Scaffold Next.js 16 app (preserving existing docs + git)

**Files:**
- Create: project scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*`, `eslint.config.mjs`, …)
- Preserve: `docs/`, `.git/`

`create-next-app` refuses to run in a directory containing non-allowlisted files (our `docs/`). Move it aside, scaffold, then restore. `.git` is allowlisted and is preserved automatically.

- [ ] **Step 1: Move docs aside so the scaffolder sees an (allowlisted) clean dir**

Run (from project root `/Volumes/MacExtend 1/SDTPL_ADM`):
```bash
mv docs ../_sdtpl_docs_tmp
```

- [ ] **Step 2: Scaffold Next.js (non-interactive)**

```bash
pnpm create next-app@latest . \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --no-turbopack --yes
```
Expected: scaffold completes; `package.json` shows `next` `16.x`, `react` `19.x`, `tailwindcss` `4.x`. If a version differs materially, stop and report before continuing.

- [ ] **Step 3: Restore docs**

```bash
rm -rf docs && mv ../_sdtpl_docs_tmp docs
```
Expected: `docs/superpowers/specs/2026-06-07-shadcn-ui-kit-clone-design.md` exists again.

- [ ] **Step 4: Verify the app builds**

```bash
pnpm build
```
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + TS"
```

---

## Task 2: Initialize shadcn/ui (Base UI) and add core components

**Files:**
- Create: `components.json`, `src/components/ui/*`, `src/lib/utils.ts`
- Modify: `src/app/globals.css` (CLI adds tokens)

> **Base UI gotcha:** the latest shadcn CLI installs onto `@base-ui/react`, not Radix. Use Base UI's `render` prop pattern; anchored widths use `w-(--anchor-width)`; `Checkbox` uses an `indeterminate` prop. Do **not** hand-edit generated primitives to Radix idioms.

- [ ] **Step 1: Initialize shadcn**

```bash
pnpm dlx shadcn@latest init --yes -b neutral
```
Expected: `components.json` created; `src/lib/utils.ts` with `cn()`; `globals.css` updated with shadcn tokens. (`-b neutral` = neutral base color, matching the reference's grayscale palette.)

- [ ] **Step 2: Add the core component set used by the shell and most pages**

```bash
pnpm dlx shadcn@latest add --yes \
  button card dropdown-menu dialog command avatar badge input label \
  separator sheet skeleton sidebar tooltip scroll-area breadcrumb \
  popover tabs table sonner
```
Expected: files appear under `src/components/ui/`. `sidebar` also adds `use-mobile` hook and sidebar CSS vars.

- [ ] **Step 3: Verify build still passes**

```bash
pnpm build
```
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: init shadcn/ui (Base UI) and add core components"
```

---

## Task 3: Playwright smoke-test harness

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (add `test:e2e` script)

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Add the test script to `package.json`**

Add to `"scripts"`:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 4: Write the first failing smoke test**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("home redirects to default dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard\/default/);
});
```

- [ ] **Step 5: Run it to verify it FAILS**

```bash
pnpm test:e2e
```
Expected: FAIL — `/` does not redirect yet (root page is the default scaffold).

- [ ] **Step 6: Make `/` redirect to the default dashboard**

Replace `src/app/page.tsx` with:
```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard/default");
}
```

- [ ] **Step 7: Run the test to verify it PASSES**

```bash
pnpm test:e2e
```
Expected: PASS (the `(dashboard)` route exists only after Task 9; until then this test may 404. If so, leave Step 7 verification until Task 9 and note it. To keep tasks independent, create a temporary `src/app/dashboard/default/page.tsx` returning `<div>default</div>`, then delete it in Task 9 when the real route group is added.)

Create temporary placeholder so this task is self-verifying:
```bash
mkdir -p src/app/dashboard/default
printf 'export default function P(){return <div>default</div>}\n' > src/app/dashboard/default/page.tsx
pnpm test:e2e
```
Expected: PASS. (This temp file is replaced by the `(dashboard)` group in Task 9.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Playwright smoke harness + root redirect"
```

---

## Task 4: Nav config — full sitemap (`src/lib/nav.ts`)

**Files:**
- Create: `src/lib/nav.ts`

This single file is the source of truth for the sidebar and ⌘K palette. Every route in the kit is listed here.

- [ ] **Step 1: Write `src/lib/nav.ts`**

```ts
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ShoppingCart, CreditCard, Hotel, KanbanSquare,
  Building2, TrendingUp, Users, BarChart3, FolderOpen, Bitcoin,
  GraduationCap, Stethoscope, Wallet, StickyNote, MessageSquare,
  Share2, Mail, ListTodo, CheckSquare, Calendar, KeyRound, Store,
  BookOpen, Bot, Image as ImageIcon, AudioLines, UserCircle, Rocket,
  Layers, Settings, Tag, ShieldCheck, Bell, TriangleAlert, Boxes,
  Component, Blocks, FlaskConical, Globe,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon?: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Dashboards",
    items: [
      { title: "Default", href: "/dashboard/default", icon: LayoutDashboard },
      { title: "E-commerce", href: "/dashboard/ecommerce", icon: ShoppingCart },
      { title: "Payment", href: "/dashboard/payment", icon: CreditCard },
      { title: "Hotel", href: "/dashboard/hotel", icon: Hotel },
      { title: "Project Management", href: "/dashboard/project-management", icon: KanbanSquare },
      { title: "Real Estate", href: "/dashboard/real-estate", icon: Building2 },
      { title: "Sales", href: "/dashboard/sales", icon: TrendingUp },
      { title: "CRM", href: "/dashboard/crm", icon: Users },
      { title: "Website Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { title: "File Manager", href: "/dashboard/file-manager", icon: FolderOpen },
      { title: "Crypto", href: "/dashboard/crypto", icon: Bitcoin },
      { title: "Academy", href: "/dashboard/academy", icon: GraduationCap },
      { title: "Hospital", href: "/dashboard/hospital", icon: Stethoscope },
      { title: "Finance", href: "/dashboard/finance", icon: Wallet },
    ],
  },
  {
    label: "Apps",
    items: [
      { title: "Kanban", href: "/apps/kanban", icon: KanbanSquare },
      { title: "Notes", href: "/apps/notes", icon: StickyNote },
      { title: "Chats", href: "/apps/chats", icon: MessageSquare },
      { title: "Social Media", href: "/apps/social", icon: Share2 },
      { title: "Mail", href: "/apps/mail", icon: Mail },
      { title: "Todo List", href: "/apps/todo", icon: ListTodo },
      { title: "Tasks", href: "/apps/tasks", icon: CheckSquare },
      { title: "Calendar", href: "/apps/calendar", icon: Calendar },
      { title: "File Manager", href: "/apps/file-manager", icon: FolderOpen },
      { title: "API Keys", href: "/apps/api-keys", icon: KeyRound },
      { title: "POS", href: "/apps/pos", icon: Store },
      { title: "Courses", href: "/apps/courses", icon: BookOpen },
    ],
  },
  {
    label: "AI Apps",
    items: [
      { title: "AI Chat", href: "/ai/chat", icon: Bot },
      { title: "AI Chat V2", href: "/ai/chat-v2", icon: Bot },
      { title: "Image Generator", href: "/ai/image-generator", icon: ImageIcon },
      { title: "Text to Speech", href: "/ai/text-to-speech", icon: AudioLines },
    ],
  },
  {
    label: "Pages",
    items: [
      { title: "Users List", href: "/users", icon: Users },
      { title: "Profile V1", href: "/profile", icon: UserCircle },
      { title: "Profile V2", href: "/profile/v2", icon: UserCircle },
      { title: "Onboarding", href: "/onboarding", icon: Rocket },
      { title: "Empty States", href: "/empty-states", icon: Layers },
      { title: "Settings", href: "/settings", icon: Settings },
      { title: "Pricing", href: "/pricing", icon: Tag },
      { title: "Authentication", href: "/login", icon: ShieldCheck },
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Error Pages", href: "/error/404", icon: TriangleAlert },
    ],
  },
  {
    label: "Others",
    items: [
      { title: "Widgets", href: "/widgets", icon: Boxes },
      { title: "Components", href: "/components", icon: Component },
      { title: "Blocks", href: "/blocks", icon: Blocks },
      { title: "Examples", href: "/examples", icon: FlaskConical },
      { title: "Website Templates", href: "/templates", icon: Globe },
    ],
  },
];

// Auth routes live outside the dashboard shell (the (auth) group).
export const authRoutes: NavItem[] = [
  { title: "Login", href: "/login" },
  { title: "Register", href: "/register" },
  { title: "Forgot Password", href: "/forgot-password" },
  { title: "Reset Password", href: "/reset-password" },
  { title: "Verify Email", href: "/verify" },
];

// Flat list of every dashboard-shell route (used by ⌘K and stub generation).
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
```

- [ ] **Step 2: Verify it type-checks**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav.ts
git commit -m "feat: add full sitemap nav config"
```

---

## Task 5: Mock data layer skeleton (`src/lib/data.ts`)

**Files:**
- Create: `src/lib/data.ts`

Holds shared types and seed mock data. Phase 1+ extends it; Phase 0 only needs enough for the default dashboard placeholder and notifications.

- [ ] **Step 1: Write `src/lib/data.ts`**

```ts
export type TeamMember = { name: string; email: string; role: string; avatar?: string };
export type Payment = {
  id: string; customer: string; email: string; amount: number;
  status: "success" | "processing" | "failed";
};
export type Notification = { id: string; title: string; description: string; time: string; read: boolean };

export const teamMembers: TeamMember[] = [
  { name: "Sofia Davis", email: "sofia@example.com", role: "Owner" },
  { name: "Jackson Lee", email: "jackson@example.com", role: "Member" },
  { name: "Isabella Nguyen", email: "isabella@example.com", role: "Member" },
];

export const latestPayments: Payment[] = [
  { id: "1", customer: "Olivia Martin", email: "olivia@example.com", amount: 1999, status: "success" },
  { id: "2", customer: "Jackson Lee", email: "jackson@example.com", amount: 39, status: "processing" },
  { id: "3", customer: "Isabella Nguyen", email: "isabella@example.com", amount: 299, status: "success" },
  { id: "4", customer: "William Kim", email: "will@example.com", amount: 99, status: "failed" },
  { id: "5", customer: "Sofia Davis", email: "sofia@example.com", amount: 39, status: "success" },
];

export const notifications: Notification[] = [
  { id: "1", title: "New subscriber", description: "You gained a new subscriber.", time: "2m ago", read: false },
  { id: "2", title: "Payment received", description: "$1,999 from Olivia Martin.", time: "1h ago", read: false },
  { id: "3", title: "Server update", description: "Deployment finished successfully.", time: "3h ago", read: true },
];
```

- [ ] **Step 2: Verify type-check + commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/data.ts
git commit -m "feat: add mock data layer skeleton"
```

---

## Task 6: Theme provider + toggle

**Files:**
- Create: `src/components/layout/theme-provider.tsx`, `src/components/layout/theme-toggle.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install next-themes**

```bash
pnpm add next-themes
```

- [ ] **Step 2: Write `src/components/layout/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 3: Write `src/components/layout/theme-toggle.tsx`**

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Toggle theme">
            <Sun className="size-5 scale-100 dark:scale-0 transition-transform" />
            <Moon className="absolute size-5 scale-0 dark:scale-100 transition-transform" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```
> Note the **Base UI `render` prop** on `DropdownMenuTrigger` instead of Radix's `asChild`.

- [ ] **Step 4: Wrap the root layout**

Replace `src/app/layout.tsx` body so it wraps children in `ThemeProvider` with `attribute="class"` and adds `suppressHydrationWarning` to `<html>`:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shadcn UI Kit",
  description: "Admin dashboard template",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Add a theme smoke test**

Append to `e2e/smoke.spec.ts`:
```ts
test("dark mode applies the dark class", async ({ page }) => {
  await page.goto("/dashboard/default");
  await page.getByLabel("Toggle theme").click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
```
(This test goes green once the header mounts the toggle in Task 8 — run it then. For now, verify type-check.)

- [ ] **Step 6: Verify + commit**

```bash
pnpm exec tsc --noEmit
git add -A
git commit -m "feat: add theme provider and toggle"
```

---

## Task 7: Reusable placeholder page + breadcrumbs

**Files:**
- Create: `src/components/placeholder-page.tsx`, `src/components/layout/breadcrumbs.tsx`

- [ ] **Step 1: Write `src/components/placeholder-page.tsx`**

```tsx
import { Construction } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
      <Construction className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">This page is coming in a later phase.</p>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/layout/breadcrumbs.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function label(segment: string) {
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          return (
            <Fragment key={href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label(seg)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label(seg)}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm exec tsc --noEmit
git add -A
git commit -m "feat: add placeholder page and breadcrumbs"
```

---

## Task 8: App sidebar, header, command palette, notifications

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`, `app-header.tsx`, `command-palette.tsx`, `notifications.tsx`

- [ ] **Step 1: Write `src/components/layout/app-sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command } from "lucide-react";
import { navGroups } from "@/lib/nav";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Command className="size-4" />
          </div>
          <span className="font-semibold group-data-[collapsible=icon]:hidden">Shadcn UI Kit</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                      <Link href={item.href}>
                        {Icon && <Icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
```
> shadcn's `SidebarMenuButton` exposes `asChild` (its own prop, not Base UI's) — keep `asChild` here as the component defines it.

- [ ] **Step 2: Write `src/components/layout/command-palette.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { navGroups } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="ml-2">Search…</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:flex">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a page name…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navGroups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${group.label} ${item.title}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  {item.icon && <item.icon className="size-4" />}
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] **Step 3: Write `src/components/layout/notifications.tsx`**

```tsx
"use client";

import { Bell } from "lucide-react";
import { notifications } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Notifications() {
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
                {unread}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((n) => (
          <div key={n.id} className="flex flex-col gap-0.5 px-2 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </div>
            <span className="text-xs text-muted-foreground">{n.description}</span>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Write `src/components/layout/app-header.tsx`**

```tsx
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandPalette } from "@/components/layout/command-palette";
import { Notifications } from "@/components/layout/notifications";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <ThemeToggle />
        <Notifications />
        <Avatar className="size-8">
          <AvatarFallback>TB</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Verify type-check**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add sidebar, header, command palette, notifications"
```

---

## Task 9: Dashboard layout group + default dashboard placeholder

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/default/page.tsx`
- Delete: temporary `src/app/dashboard/default/page.tsx` from Task 3

- [ ] **Step 1: Remove the temporary default page from Task 3**

```bash
rm -rf src/app/dashboard
```

- [ ] **Step 2: Write `src/app/(dashboard)/layout.tsx`**

```tsx
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 3: Write the default dashboard placeholder**

`src/app/(dashboard)/dashboard/default/page.tsx`:
```tsx
import { PlaceholderPage } from "@/components/placeholder-page";

export default function DefaultDashboardPage() {
  return <PlaceholderPage title="Default Dashboard" />;
}
```
> Phase 1 replaces this placeholder with the real Default dashboard widgets.

- [ ] **Step 4: Run dev and verify the shell + theme + ⌘K tests pass**

```bash
pnpm test:e2e
```
Expected: all three tests (redirect, dark mode, plus the ⌘K test added next) — at minimum redirect + dark mode PASS now that the header is mounted.

- [ ] **Step 5: Add the ⌘K smoke test**

Append to `e2e/smoke.spec.ts`:
```ts
test("command palette opens and navigates", async ({ page }) => {
  await page.goto("/dashboard/default");
  await page.keyboard.press("Meta+k");
  await page.getByPlaceholder("Type a page name…").fill("CRM");
  await page.getByRole("option", { name: /CRM/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/crm/);
});
```

- [ ] **Step 6: Run e2e (CRM route stub created in Task 10 — expect this test to pass after Task 10)**

```bash
pnpm test:e2e
```
Expected: redirect + dark-mode PASS now; ⌘K test passes after Task 10 creates `/dashboard/crm`. Note the dependency and proceed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add dashboard shell layout + default placeholder"
```

---

## Task 10: Generate placeholder pages for every remaining route

**Files:**
- Create: one `page.tsx` per route under `src/app/(dashboard)/...` for all `allNavItems` except the default dashboard already created.

Use a generation script with the explicit route→title map so every page is concrete. Run from project root.

- [ ] **Step 1: Generate all dashboard-shell route stubs**

```bash
node -e '
const fs = require("fs");
const path = require("path");
const routes = [
  ["dashboard/ecommerce","E-commerce"],["dashboard/payment","Payment"],
  ["dashboard/hotel","Hotel"],["dashboard/project-management","Project Management"],
  ["dashboard/real-estate","Real Estate"],["dashboard/sales","Sales"],
  ["dashboard/crm","CRM"],["dashboard/analytics","Website Analytics"],
  ["dashboard/file-manager","File Manager"],["dashboard/crypto","Crypto"],
  ["dashboard/academy","Academy"],["dashboard/hospital","Hospital"],
  ["dashboard/finance","Finance"],
  ["apps/kanban","Kanban"],["apps/notes","Notes"],["apps/chats","Chats"],
  ["apps/social","Social Media"],["apps/mail","Mail"],["apps/todo","Todo List"],
  ["apps/tasks","Tasks"],["apps/calendar","Calendar"],["apps/file-manager","File Manager"],
  ["apps/api-keys","API Keys"],["apps/pos","POS"],["apps/courses","Courses"],
  ["ai/chat","AI Chat"],["ai/chat-v2","AI Chat V2"],
  ["ai/image-generator","Image Generator"],["ai/text-to-speech","Text to Speech"],
  ["users","Users List"],["profile","Profile V1"],["profile/v2","Profile V2"],
  ["onboarding","Onboarding"],["empty-states","Empty States"],["settings","Settings"],
  ["pricing","Pricing"],["notifications","Notifications"],["error/404","Error 404"],
  ["error/500","Error 500"],
  ["widgets","Widgets"],["components","Components"],["blocks","Blocks"],
  ["examples","Examples"],["templates","Website Templates"],
];
const comp = (t) => "P" + t.replace(/[^a-zA-Z0-9]/g,"");
for (const [route,title] of routes) {
  const dir = path.join("src/app/(dashboard)", route);
  fs.mkdirSync(dir, { recursive: true });
  const body = `import { PlaceholderPage } from "@/components/placeholder-page";\n\nexport default function ${comp(title)}Page() {\n  return <PlaceholderPage title=${JSON.stringify(title)} />;\n}\n`;
  fs.writeFileSync(path.join(dir, "page.tsx"), body);
}
console.log("generated", routes.length, "dashboard route stubs");
'
```
Expected: `generated 44 dashboard route stubs`.

- [ ] **Step 2: Create the (auth) layout group + auth route stubs**

```bash
mkdir -p "src/app/(auth)"
cat > "src/app/(auth)/layout.tsx" <<'EOF'
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
EOF

node -e '
const fs = require("fs");
const path = require("path");
const routes = [
  ["login","Login"],["register","Register"],["forgot-password","Forgot Password"],
  ["reset-password","Reset Password"],["verify","Verify Email"],
];
const comp = (t) => "P" + t.replace(/[^a-zA-Z0-9]/g,"");
for (const [route,title] of routes) {
  const dir = path.join("src/app/(auth)", route);
  fs.mkdirSync(dir, { recursive: true });
  const body = `import { PlaceholderPage } from "@/components/placeholder-page";\n\nexport default function ${comp(title)}Page() {\n  return <PlaceholderPage title=${JSON.stringify(title)} />;\n}\n`;
  fs.writeFileSync(path.join(dir, "page.tsx"), body);
}
console.log("generated", routes.length, "auth route stubs");
'
```
Expected: `generated 5 auth route stubs`.

- [ ] **Step 3: Add a 404 page**

`src/app/not-found.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Button asChild render={<Link href="/dashboard/default">Back to dashboard</Link>} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build passes with all routes**

```bash
pnpm build
```
Expected: build lists all ~50 routes, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add placeholder pages for all routes + auth group"
```

---

## Task 11: Full route-render smoke test + lint clean

**Files:**
- Modify: `e2e/smoke.spec.ts`, `eslint.config.mjs`

- [ ] **Step 1: Add a data-driven route-render test**

Append to `e2e/smoke.spec.ts`:
```ts
import { allNavItems } from "../src/lib/nav";

for (const item of allNavItems) {
  test(`renders ${item.href} without error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(item.href);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
```

- [ ] **Step 2: Run the full e2e suite**

```bash
pnpm test:e2e
```
Expected: all route-render tests PASS, plus redirect / dark-mode / ⌘K PASS.

- [ ] **Step 3: Run lint and resolve the SSR mounted-guard warning**

```bash
pnpm lint
```
If `react-hooks/set-state-in-effect` errors on a mounted guard, downgrade it to a warning in `eslint.config.mjs`:
```js
// inside the exported config array, add a rules override object:
{
  rules: {
    "react-hooks/set-state-in-effect": "warn",
  },
},
```
Re-run `pnpm lint`; expected: passes (warnings allowed).

- [ ] **Step 4: Final build verification**

```bash
pnpm build
```
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add full route-render smoke suite; lint config"
```

---

## Task 12: README + .gitignore sanity

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Confirm `.gitignore` ignores build artifacts**

```bash
grep -qE "node_modules|\.next" .gitignore && echo "gitignore ok"
```
Expected: `gitignore ok` (create-next-app adds these; also ensure `/test-results` and `/playwright-report` are ignored — add them if missing).

- [ ] **Step 2: Write a short `README.md`**

```markdown
# SDTPL_ADM — shadcn UI Kit Clone

Faithful clone of https://shadcnuikit.com on Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (Base UI).

## Dev
- `pnpm dev` — run dev server
- `pnpm build` — production build (does not run lint)
- `pnpm lint` — lint
- `pnpm test:e2e` — Playwright route + interaction smoke tests

## Structure
- `src/lib/nav.ts` — sitemap driving sidebar + ⌘K
- `src/lib/data.ts` — mock data + types
- `src/app/(dashboard)` — app-shell routes · `src/app/(auth)` — auth routes

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design + phase plans.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add README and gitignore artifacts"
```

---

## Phase 0 Completion Criteria

- [ ] `pnpm build` succeeds; all ~50 routes listed.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test:e2e` green: root redirect, dark-mode toggle, ⌘K navigate, and every `allNavItems` route renders error-free inside the shell.
- [ ] Sidebar shows all five groups; collapse works; active item highlights.
- [ ] `/dashboard/default` renders inside the shell (placeholder content; real widgets are Phase 1).
- [ ] Auth routes render in the bare `(auth)` layout (no shell).

**Next:** Phase 1 (Dashboards) — start a new spec/plan; begin with the real Default dashboard, then expand to the other 13.

---

## Self-Review Notes

- **Spec coverage:** App shell (§6.1 → Tasks 8–9), theming (§6.2 → Task 6), routing skeleton/all-routes-stub (§6.3 → Tasks 9–10), nav.ts (§6.4 → Task 4), data.ts (§6.4 → Task 5), ⌘K + notifications (§6.1 → Task 8), charts/table libs (§6.5 → deferred to Phase 1 when first used — noted, not omitted), verification (§9 → Tasks 3, 11). All Phase 0 items in spec §10 mapped.
- **Placeholder scan:** Chart/table/drag libraries are intentionally deferred to the phase that first needs them (per spec §6.5) — not silent omissions.
- **Type consistency:** `NavItem`/`NavGroup`/`navGroups`/`allNavItems`/`authRoutes` used consistently across Tasks 4, 8, 11. `PlaceholderPage({title})` signature consistent across Tasks 7, 9, 10. `Notification`/`notifications` consistent across Tasks 5, 8.
- **Known cross-task dependency:** the ⌘K test (Task 9 Step 5) depends on the `/dashboard/crm` stub from Task 10 — flagged in-task; full suite verified green in Task 11.
