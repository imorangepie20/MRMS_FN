# Data Table Component Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/components/data-table` detail page with 6 TanStack Table variants, wire the catalog card href, and add an e2e test.

**Architecture:** A single `variants.tsx` client component exports 6 named variant components. The Next.js page at `src/app/(dashboard)/components/data-table/page.tsx` imports them and renders a vertical stack with breadcrumb/header. The shared dataset (5 payment rows) is defined at the top of variants.tsx; each variant is self-contained with its own `useReactTable` + local state.

**Tech Stack:** Next.js 16, React 19, TanStack Table v8 (`@tanstack/react-table`), @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities, Tailwind v4, shadcn/ui on Base UI, Playwright e2e.

---

### Task 1: Create variants.tsx with 6 Data Table variants

**Files:**
- Create: `src/components/pages/components-data-table/variants.tsx`

- [ ] **Step 1: Create the variants file**

The file exports 6 components:
1. `BasicSelectionVariant` — selection + pagination, `data-testid="dt-basic"`
2. `ExpandableRowsVariant` — expand/collapse row detail
3. `VerticalScrollVariant` — ~10 rows in a fixed-height scrollable container
4. `DraggableRowsVariant` — row reorder via @dnd-kit
5. `DraggableColumnsVariant` — column reorder via @dnd-kit horizontal
6. `ActionButtonsVariant` — edit/delete buttons + ⋯ dropdown

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm exec tsc --noEmit 2>&1 | head -40`
Expected: 0 errors related to the new file.

---

### Task 2: Create the page

**Files:**
- Create: `src/app/(dashboard)/components/data-table/page.tsx`

- [ ] **Step 1: Create the page file** with breadcrumb, h1, description, flex-col gap-8 layout rendering all 6 variant sections.

- [ ] **Step 2: Verify build includes the route**

Run: `cd "/Volumes/MacExtend 1/SDTPL_ADM" && pnpm build 2>&1 | grep data-table`
Expected: `/components/data-table` appears in output.

---

### Task 3: Wire catalog card href

**Files:**
- Modify: `src/components/pages/components-catalog/data.ts`

- [ ] **Step 1: Add href to Data Table entry**

Change `{ name: "Data Table", variants: 6, ... }` to include `href: "/components/data-table"`.

---

### Task 4: Add e2e test

**Files:**
- Create: `e2e/components-data-table.spec.ts`

- [ ] **Step 1: Create the test file** with 3 tests: render check, select-all interaction, catalog link.

---

### Task 5: Final verification

- [ ] **Step 1:** `pnpm exec tsc --noEmit` — 0 errors
- [ ] **Step 2:** `pnpm build` — success, lists `/components/data-table`
- [ ] **Step 3:** `pnpm lint` — 0 errors
- [ ] **Step 4:** Commit
