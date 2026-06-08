# Phase 1e — Final Dashboards (Project Management · Website Analytics · File Manager · Academy)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Faithfully build the last 4 dashboards, completing all 14. Replace placeholders for `/dashboard/project-management`, `/dashboard/analytics`, `/dashboard/file-manager`, `/dashboard/academy`. Reuse shared `KpiCard`; per-dashboard widgets + colocated `data.ts`.

**Conventions (same as prior phases):** shared `KpiCard` at `@/components/dashboards/shared/kpi-card`; widgets under `src/components/dashboards/<name>/`; shadcn `card/chart/table/badge/progress/avatar/button/select/tabs/calendar/separator`; Recharts; Base UI (`render` prop; Tabs/Select `onValueChange` null-guard with `if (v != null)`); charts/interactive `"use client"`, pages server; `CardTitle` is a div; only import what you use; status/priority badges via `cn()` on `Badge`; FIXED date literals only (never argless `new Date()`); smoke-test titles with `getByText(..., {exact:true})`. Branch `feat/phase-1e-final-dashboards`. References: https://shadcnuikit.com/dashboard/{project-management,website-analytics,file-manager,academy} (note our routes `/dashboard/analytics` ↔ reference `website-analytics`).

---

## Task 1: Project Management (`/dashboard/project-management`) — header "Project Management"

1. **KPI row (4 `KpiCard`s):** Total Revenue `$45,231.89` `+20.1%` up; Active Projects `1,423` `+5.02%` up; New Leads `3,500` `-3.58%` **down**; Time Spent `168h 40m` `-3.58%` **down**.
2. **Projects Overview** — chart Card; bar/area, "Total for the last 3 months", a range toggle (Tabs: 3 months / 30 days / 7 days). Client.
3. **Professionals** — stat Card `357` + an avatar group ("Today's Heroes": 4–5 avatars).
4. **Highlights** — Card with 3 tiles: Avg. Client Rating `7.8 / 10`, Avg. Quotes `730`, Avg. Agent Earnings `$2,309`.
5. **Reminders** — list Card; 3 reminders with priority `Badge` (Low/Medium/High) + a "Show the other 10 reminders" link.
6. **Achievement by Year** — bar chart Card; "January – June 2026"; bars incl. values `57`, `29`, `35` projects.
7. **Recent Projects** — `Table` columns **Project Name, Client Name, Start Date, Deadline, Status, Progress** (Progress = a small `Progress` bar; values 30/60/100/50/45/20%). 6 rows.

Data → `project-management/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add project management dashboard`.

---

## Task 2: Website Analytics (`/dashboard/analytics`) — header "Website Analytics"

1. **KPI row (4 `KpiCard`s):** Daily Active Users `3,450` `+12.1%` up; Weekly Sessions `1,342` `-9.8%` **down**; Duration `5.2min` `+7.7%` up; Conversion Rate `2.8%` `+4.3%` up.
2. **Traffic Overview** — area/line chart Card (sessions over ~12 points), "Last 28 days". Client.
3. **Traffic Sources** — donut Card: Direct `432`, Organic `216`, Referral `180`, Social `120`; summary stats "Page Views `2.3K`", "Leads `1.6K`". Client.
4. **Support** — Card with 3 small stats: New Tickets `40`, Open Tickets `25`, Response Time `1 Day`.
5. **Sales Snapshot** — Card with Average Daily Sales `$28,450` and Sales Overview `$42.5K` (Orders 62.2% / Visits 25.5% with progress bars).
6. **Sales by Countries** — `Table`: Country (flag emoji + name), Change %, Revenue. Rows: United States `+27.4%`, Brazil `+20.1%`, India `-5%`, Australia `+10.9%`, France `+2.1%`, Greece `-0.1%` (revenue figures of your choosing, descending).
7. **Monthly Campaign State** — `Table` email engagement: Metric, Count, Change. Rows: Opened `6,043` `+2.1%`, Clicked `600` `-2.1%`, Subscribe `490` `+8.5%`, Complaints `490` `+4.5%`, Unsubscribe `1,200` `-0.5%`.

Data → `analytics/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add website analytics dashboard`.

---

## Task 3: File Manager (`/dashboard/file-manager`) — header "File Manager"

Header right: an "Upload" primary `Button` (upload icon).
1. **Type cards (4):** small Cards with item count + size + a `Progress`: Documents (`120 items`, `2.1 GB used`, 35%), Images (`250 items`, `3.8 GB used`, 62%), Videos (`38 items`, `7.5 GB used`, 89%), Others (`64 items`, `1.2 GB used`, 28%). Use a distinct icon per type.
2. **Folders (3):** Card "Folders" or 3 folder Cards: Documents `120 items` "Last update: 10 days ago"; Images `250 items` "2 days ago"; Downloads `80 items` "Yesterday" — each with a folder icon + a `⋯`/star action button.
3. **Storage Space Used** — Card; a radial or `Progress` showing `1.8 GB used / 3 GB total` (60%).
4. **Monthly File Transfer** — chart Card; area/line; "11 May 2026 - 07 Jun 2026". Client.
5. **Recently Uploaded Files** — `Table` columns **Name, Size, Upload Date, Actions** (Actions = a `⋯` dropdown or download icon button). 5 rows, sizes from `957 KB` to `150.68 MB`, dates Mar–Apr 2025; file-type icon next to each name.

Data → `file-manager/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add file manager dashboard`.

---

## Task 4: Academy (`/dashboard/academy`) — header "Academy"

- **Greeting** — Card "Hi, Andrew 👋" + a short motivational line + maybe a "Continue learning" button.
1. **Learning Path** — Card "Learning Path"; title "Full-Stack Developer", "4 of 10 modules completed", a `Progress` at 40%.
2. **Leaderboard** — Card "Leaderboard"; ranked list of 4: Liam Smith `5000 pts`, Emma Brown `4800 pts`, Noah Johnson `4600 pts`, Olivia Davis `4400 pts` (rank number + avatar + name + points).
3. **Success Rate** — `KpiCard`-style Card: `88%`, sublabel "3% increase (target 100%)".
4. **Total Students** — Card: `1,500` total, "1,320 passing (88.0%)".
5. **Progress Statistics** — Card: Total Activity `72.5%` (progress), In Progress `18 courses`, Completed `30 courses`.
6. **Activity Breakdown** — donut Card: Mentoring `65.2%`, Organization `25%`, Planning `9.8%`. Client.
7. **Course Progress by Month** — chart Card; area/line; "50.56% increase", "11 May 2026 - 07 Jun 2026". Client.
8. **Popular Courses** — `Table` columns **Course, Category, Score, Progress**. 6 rows (scores 4.2–4.8; Progress as a bar or % ).

Data → `academy/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add academy dashboard`.

---

## Task 5: Smoke tests + full verification

Create `e2e/dashboards-final.spec.ts` — per dashboard assert status<400, no `pageerror`, 3 exact unique widget texts (READ widgets; e.g. PM: "Recent Projects", "Achievement by Year", "Highlights"/"Reminders"; analytics: "Sales by Countries", "Traffic Sources", "Monthly Campaign State"; file-manager: "Recently Uploaded Files", "Storage Space Used", "Monthly File Transfer"; academy: "Leaderboard", "Learning Path", "Popular Courses"). `getByText(t,{exact:true}).first()`. Run full suite (`CI=1`, kill :3000) — expect 60 prior + 4 = 64 pass; fix real render bugs at root. `pnpm lint` 0 errors (remove unused imports). Commit `test: add final dashboards smoke tests`.

---

## Completion Criteria
- [ ] `/dashboard/{project-management,analytics,file-manager,academy}` render faithful widget sets.
- [ ] build + lint (0 errors) + full e2e (64) green; charts/calendars no hydration errors.
- [ ] **All 14 dashboards complete** → Phase 1 done. Sidebar/⌘K navigate to 14 real dashboards.

**Next (Phase 2):** Apps (Kanban, Mail, Chat, Calendar, …).
