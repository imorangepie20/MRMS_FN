# Phase 1d — Ops Dashboards (Hotel · Hospital · Real Estate)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Faithfully build `/dashboard/hotel`, `/dashboard/hospital`, `/dashboard/real-estate`, replacing placeholders. These are rich dashboards (11–13 widgets each). Reuse shared `KpiCard`; per-dashboard widgets + colocated `data.ts`.

**Conventions (same as Phase 1b/1c):** shared `KpiCard` at `@/components/dashboards/shared/kpi-card`; widgets under `src/components/dashboards/<name>/`; shadcn `card/chart/table/badge/progress/avatar/button/select/tabs/calendar/separator`; Recharts; Base UI (`render` prop, Checkbox `indeterminate` boolean, Select `onValueChange` may emit `string|null`); charts/interactive widgets `"use client"`, pages server; `CardTitle` is a div; only import what you use; status badges via `cn()` on `Badge`; smoke-test card titles with `getByText(..., {exact:true})`. Branch `feat/phase-1d-ops-dashboards`. References: https://shadcnuikit.com/dashboard/{hotel,hospital-management,real-estate} (note: our hospital route is `/dashboard/hospital`).

---

## Task 1: Hotel dashboard (`/dashboard/hotel`) — header "Hotel"

**Widgets (faithful):**
1. **KPI row (4 `KpiCard`s):** Today's Check-in `200`; Today Check-out `34`; Total Guests `3,432` (delta `+152` or `+4.6%` up); Total Amount `$668,726` (delta `+12%` up).
2. **Total Sales This Week** — stat card `$86,000`.
3. **Revenue** — stat card `$12,480.00` with `+16% from last month`.
4. **Reservations** — small card with 3 status counts: Confirmed, Checked In, Checked Out (pick counts e.g. 48 / 32 / 26) with colored dots/badges.
5. **Campaign Overview** — card: Booked `290`, Visited `638`, Performance `12+` (3 stats).
6. **Bookings** — chart card; a DWMY toggle (Tabs: D/W/M/Y) + a bar or area chart; header "Total Bookings" `20,395.50`.
7. **Online vs Offline Booking** — card; a small donut or two bars: Online `14,839`, Offline `5,556`.
8. **Recent Activities** — list card; 4 guest entries (avatar + guest name + "Room {n}" + "{n} mins ago", 16–48 mins).
9. **Booking List** — `Table` columns **Booking ID, Guest Name, Room Type, Room Number, Duration, Check-In, Check-Out, Status** (status badge). 6 rows.

Data → `hotel/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add hotel dashboard`.

---

## Task 2: Hospital dashboard (`/dashboard/hospital`) — header "Hospital"

> The reference renders KPI values as 0 (loading state). Use realistic values with the EXACT deltas below.

**Widgets (faithful):**
1. **KPI row (4 `KpiCard`s):** Total Appointments `1,250` `+20.1%` up "from last month"; New Patients `320` `+180.1%` up; Operations `86` `-19%` **down**; Total Revenue `$45,231.89` `+20.1%` up.
2. **Patient Visits by Gender** — bar chart card; Male vs Female across ~6 months (two series).
3. **Patients by Department** — bar chart card; departments: Cardiology, Neurology, Orthopedics, Pediatrics, Oncology, ENT with counts.
4. **Calendar** — card with shadcn `Calendar` (June 2026 month) + text "No appointments for this day".
5. **Notes** — list card; 4 scheduled items (Surgery, Team meeting, New staff orientation, Patient checkup) with times.
6. **Top Treatment** — card; rows with `Progress`: Physical Therapy `500` patients `78%`, Cardiac Care `350` `48%`, Orthopedic Surgery `220` `35%`, Dental Care `180` `28%`.
7. **Upcoming Appointments** — `Table` columns **Patient, Date, Time, Doctor, Department**. 7 rows.
8. **Patients with Last Procedure** — list card; 5 patients (avatar initials + name + email + procedure + date).

Data → `hospital/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add hospital dashboard`.

---

## Task 3: Real Estate dashboard (`/dashboard/real-estate`) — header "Real Estate"

**Widgets (faithful):**
1. **KPI row (4 `KpiCard`s):** Active Leads `120` `+12%` up; Total Revenue `$96.7M` `+12%` up; Active Listing `23` `-12%` **down**; Total Closed `42` `+12%` up.
2. **Revenue / Visit** — chart card; line/area with a W/M/Y toggle (Tabs).
3. **Featured Property — "The Somerset"** — showcase card: a colored banner placeholder (image area) + stats `175 Sold`, `125 Rented`, `2K+ Views`, and footer "Recommended to 14 Leads" + "42 Closed Deals".
4. **On Progress Deals** — stat card `132 Deals`.
5. **Reminders** — list card; 3 items dated Oct 8, Oct 12, Oct 17.
6. **Leads Contact** — list card; 4 agents (avatar + name + location + a call/message icon button).
7. **Sales Analytics** — bar chart card; multi-category: Online, Offline, Agent, Marketing (grouped or stacked across months).
8. **Property Overview** — donut chart card; total `1,323` properties, Listed `65%`, Sold `35%`.
9. **Active Listing** — `Table` columns **Property, Location, Type, Cost, Active Leads, Views, Status**. 8 rows (Property cell = colored square + name).
10. **Calendar** — card with shadcn `Calendar` (June 2025) + 3 upcoming appointments/follow-ups listed below.

Data → `real-estate/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add real-estate dashboard`.

---

## Task 4: Smoke tests + full verification

Create `e2e/dashboards-ops.spec.ts` — per dashboard assert status<400, no `pageerror`, 3 exact unique widget texts (READ widgets to pick exact strings, e.g. hotel: "Booking List", "Campaign Overview", "Recent Activities"; hospital: "Top Treatment", "Upcoming Appointments", "Patients by Department"; real-estate: "Featured Property" or "The Somerset", "Sales Analytics", "Property Overview"). `getByText(t,{exact:true}).first()`. Run full suite (`CI=1`, kill :3000) — expect 57 prior + 3 = 60 pass; fix real render bugs at root (charts `"use client"`; Calendar may warn if given bad props — verify the `Calendar` API). `pnpm lint` 0 errors (remove unused imports). Commit `test: add ops dashboards smoke tests`.

---

## Completion Criteria
- [ ] `/dashboard/{hotel,hospital,real-estate}` render faithful widget sets (no placeholder).
- [ ] build + lint (0 errors) + full e2e (60) green; charts + calendars no hydration errors.

**Next:** final batch — Project Management, Website Analytics, File Manager, Academy (4 dashboards) → completes all 14.
