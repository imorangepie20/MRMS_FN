# Phase 1b — Commerce Dashboards (E-commerce · Sales · CRM)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Faithfully build 3 commerce dashboards (`/dashboard/ecommerce`, `/dashboard/sales`, `/dashboard/crm`), replacing their placeholders, using a shared `KpiCard` plus dashboard-specific widgets + mock data.

**Architecture:** A shared `src/components/dashboards/shared/kpi-card.tsx` is reused across all dashboards. Each dashboard gets a folder `src/components/dashboards/<name>/` with widget components + a colocated `data.ts`, composed by the route `page.tsx`. Charts use shadcn `chart` (Recharts); tables use shadcn `Table` (simple) or TanStack where rich. Interactive widgets are client components; pages stay server components.

**Tech:** Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (Base UI) · Recharts · @tanstack/react-table. **Reminders:** Base UI `render` prop (not `asChild`); Checkbox uses a separate `indeterminate` boolean; keep `CardTitle` as `<div>`; Playwright runs the PROD build; test card titles with `getByText(..., {exact:true})`.

**Reference:** https://shadcnuikit.com/dashboard/{ecommerce,sales,crm}. Spec: [phase-1 design §5](../specs/2026-06-07-phase-1-dashboards-design.md).

---

## Task 1: Shared `KpiCard`

**File:** Create `src/components/dashboards/shared/kpi-card.tsx`.

```tsx
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  sublabel?: string;
  icon?: LucideIcon;
};

export function KpiCard({ label, value, delta, trend = "up", sublabel, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center justify-between">
          {label}
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {delta ? (
          <p className={cn("flex items-center gap-1 text-xs", trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {trend === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
            {sublabel ? <span className="text-muted-foreground">{sublabel}</span> : null}
          </p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
```
Verify `tsc --noEmit`; commit `feat: add shared KpiCard`.

---

## Task 2: E-commerce dashboard (`/dashboard/ecommerce`)

**Files:** `src/components/dashboards/ecommerce/data.ts`, widget components, and the page `src/app/(dashboard)/dashboard/ecommerce/page.tsx`.

**Page header:** title "E-commerce" (use a simple `<h1 className="text-2xl font-semibold tracking-tight">`).

**Widgets (faithful to reference):**
1. **KPI row (4 `KpiCard`s):** Best Seller of the Month `$15,231.89` `+65%` up "from last month"; Monthly Recurring Revenue `$34.1K` `+6.1%` up; Users `500.1K` `+19.2%` up; User Growth `11.3%` `-1.2%` down.
2. **Total Revenue** — bar chart card; two series Desktop (`24,828`) vs Mobile (`25,010`), "Last 28 days". Use ~12 monthly data points per series (mock).
3. **Sales by Location** — card with header value `$42,379` `+2.5%`; horizontal progress bars: Canada 85%, Greenland 80%, Russia 63%, China 60%, Australia 45%, Greece 40% (label + `Progress` bar + percent).
4. **Store Visits by Source** — donut/pie chart (Recharts `PieChart`+`Pie`) with sources e.g. Direct 38%, Social 32%, Email 18%, Referral 12%.
5. **Customer Reviews** — card: big "4.5 out of 5"; star breakdown rows 5★ 4000, 4★ 2100, 3★ 800, 2★ 631, 1★ 344 (each a `Progress` proportional to total); a sample review (avatar + name + text).
6. **Recent Orders** — `Table` with columns ID, Customer, Product, Amount, Status (badge). 8 mock rows.
7. **Best Selling Products** — `Table`/list with columns Product (name + small colored square as placeholder image), Price, Sold. 8 mock rows.

**Data (`ecommerce/data.ts`):** export the chart series, location list, review breakdown, sources, `recentOrders` (8), `bestSellers` (8). Use realistic mock values.

**Layout:** KPI row = `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`; then a responsive grid mixing the charts/cards; tables span full width near the bottom.

Verify `tsc --noEmit` + the page builds; commit `feat: add e-commerce dashboard`.

---

## Task 3: Sales dashboard (`/dashboard/sales`)

**Files:** `src/components/dashboards/sales/data.ts`, widgets, page `src/app/(dashboard)/dashboard/sales/page.tsx`. Header title "Sales".

**Widgets:**
1. **KPI row (4 `KpiCard`s):** Total Balance `$103,045` `3.6%` up "Compare from last month"; Total Income `$78,000` `2.5%` up; Total Expense `$15,010` `6.0%` down; Total Sales Tax `$9,090` `5.0%` up.
2. **Revenue Chart** — area chart card, "Last 28 days", two series Desktop (`13,746`) vs Mobile (`13,580`) (~12 points each).
3. **Best Selling Product** — list of 6: Sports Shoes 316 sold, Black T-Shirt 274, Jeans 195, Red Sneakers 402, Red Scarf 280, Kitchen Accessory 150 (thumbnail square + name + "{n} sold").
4. **Track Order Status** — 4 small stat boxes: New Order 43 (+0.5%), On Progress 12 (+0.3%), Completed 40 (+0.5%), Return 2 (+0.5%).
5. **Order Table** — `Table` columns ID, Customer Name, Qty Items, Amount, Payment Method, Status (badge). 6 mock rows.

Verify + commit `feat: add sales dashboard`.

---

## Task 4: CRM dashboard (`/dashboard/crm`)

**Files:** `src/components/dashboards/crm/data.ts`, widgets, page `src/app/(dashboard)/dashboard/crm/page.tsx`. Header title "CRM".

**Widgets:**
1. **KPI row (3 `KpiCard`s):** Total Customers `1890` `+10.4%` up "from last month"; Total Deals `1,300` `-0.8%` down; Total Revenue `$435,578` `+20.1%` up.
2. **Leads by Source** — bar chart card: Social 275, Email 200, Call 287, Others 173.
3. **Your target is incomplete** — card with a radial/`Progress` showing **48%** completion + supporting text.
4. **Tasks** — list card, 3 items: "Follow up with Acme Inc." (High, due soon), "Prepare quarterly report" (Medium), "Update customer profiles" (Low) — each with a priority `Badge` + due date.
5. **Sales Pipeline** — funnel/stage card, 5 stages with deals/value/percent: Lead 235 / $420,500 / 38%; Qualified 146 / $267,800 / 24%; Proposal 84 / $192,400 / 18%; Negotiation 52 / $129,600 / 12%; Closed Won 36 / $87,200 / 8% (render each as a row: stage name + counts + a `Progress`/bar sized to percent).
6. **Leads** — `Table` columns Status (badge), Email, Amount. 5 mock rows.

Verify + commit `feat: add crm dashboard`.

---

## Task 5: Smoke tests + full verification

**File:** Create `e2e/dashboards-commerce.spec.ts`.

```ts
import { test, expect } from "@playwright/test";

const pages = [
  { href: "/dashboard/ecommerce", title: "E-commerce", marks: ["Best Seller of the Month", "Recent Orders", "Customer Reviews"] },
  { href: "/dashboard/sales", title: "Sales", marks: ["Total Balance", "Track Order Status", "Revenue"] },
  { href: "/dashboard/crm", title: "CRM", marks: ["Total Customers", "Sales Pipeline", "Leads by Source"] },
];

for (const p of pages) {
  test(`${p.href} renders its widgets`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(p.href);
    for (const m of p.marks) await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
```
Adjust each `marks` string to text that actually renders (exact, unique). Then:
```bash
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
CI=1 pnpm exec playwright test 2>&1 | tail -20
```
Expected: all pass (51 prior + 3 new = 54). Fix real render errors at the root (charts must be `"use client"`). Then `pnpm lint` (0 errors). Commit `test: add commerce dashboards smoke tests`.

---

## Completion Criteria
- [ ] `/dashboard/{ecommerce,sales,crm}` render their faithful widget sets (no placeholder).
- [ ] `pnpm build` + `pnpm lint` (0 errors) + full e2e (54) green; charts render without hydration errors.
- [ ] No regression in prior suites.

**Next:** remaining 10 dashboards in subsequent batches (Payment/Crypto/Finance; Hotel/Hospital/Real Estate; Project Mgmt/Analytics/File Manager/Academy).
