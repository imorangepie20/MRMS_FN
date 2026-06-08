# Phase 1c — Finance Dashboards (Payment · Crypto · Finance)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Faithfully build `/dashboard/payment`, `/dashboard/crypto`, `/dashboard/finance`, replacing placeholders. Reuse shared `KpiCard`; per-dashboard widgets + colocated `data.ts`.

**Conventions (same as Phase 1b):** shared `KpiCard` at `@/components/dashboards/shared/kpi-card`; widgets under `src/components/dashboards/<name>/`; shadcn `card/chart/table/badge/progress/avatar/button/select/tabs/input`; Recharts; Base UI (`render` prop, Checkbox `indeterminate` boolean); charts are `"use client"`, pages server; `CardTitle` is a div; status badges via `cn()` on `Badge`; smoke-test card titles with `getByText(..., {exact:true})`. Branch `feat/phase-1c-finance-dashboards`. Reference: https://shadcnuikit.com/dashboard/{payment,crypto,finance}.

---

## Task 1: Payment dashboard (`/dashboard/payment`) — header "Payment"

**Widgets (faithful):**
1. **Balances** — card "Total funds in all balances" big `1,740.30 USD`; below, 3 currency rows (USD `1,200.00`, EUR `380.50`, GBP `159.80`) each with flag-ish label + amount.
2. **Verification alert** — a subtle bordered/`Badge`-accented card: "You have information to submit in verification center" + a "Verify" button.
3. **Exchange Rates** — card "Exchange Rates", subtitle "Last updated: 11:08 AM"; a period toggle (Tabs or buttons: 1D / 7D / 30D / 90D / 1Y, 7D default) over a Recharts **line/area** chart of a sample EUR/USD rate (~12 points).
4. **Convert Currencies** — card "Convert Currencies": a From amount `Input` + currency `Select` (USD), a To amount `Input` + currency `Select` (EUR), and a "Rate Alerts" button.
5. **Transactions** — `Table` columns **Date, Description, Status, Amount** (Amount right-aligned, green for +, red for −; Status badge). 7 rows Aug 4–20 2025 with values from `-3,420.00` to `+5,651.75` USD (mix of "Withdraw"/"Payment" descriptions).

Data → `payment/data.ts`. Layout: top row Balances + Verification + Exchange Rates; Convert + Transactions below. `tsc --noEmit && pnpm build`; commit `feat: add payment dashboard`.

---

## Task 2: Crypto dashboard (`/dashboard/crypto`) — header "Crypto"

**Widgets (faithful):**
1. **Overview KPI row (4 `KpiCard`s):** Transactions `150`; Wallets `3`; Current Balance `$46,200`; USDT Balance `4,620,910 USDT` delta `+12%` up.
2. **Bitcoin Price** — card with a Recharts **area chart** of BTC price (~24 points), header value `$46,200` and a `+12%` change, period label "Last 7 days". (Standard crypto price chart.)
3. **Digital Wallets** — card "Wallets"; 3 rows: Bitcoin `4.434953 BTC`, Ethereum `4.434953 ETH`, Avalanche `3.434953 AVAX` (coin icon circle + name + amount + small fiat value).
4. **Trade** — card "Trade": Buy/Sell toggle (Tabs or two buttons), a coin `Select` (Bitcoin/BTC default), an amount `Input` (BTC) and a second `Input` (USD), and a "Buy"/"Sell" submit button (client state for the toggle).
5. **Recent Activities** — `Table`/list, 6 rows: action (Buy/Sell/Send badge) + coin + date + BTC amount + USD amount.
6. **Balance Summary** — 3 small stat cards: Total Received `2.010550 BTC`, Total Send `1.201055 BTC`, Total Withdraw `5.41055 BTC`.

Data → `crypto/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add crypto dashboard`.

---

## Task 3: Finance dashboard (`/dashboard/finance`) — header "Finance"

**Widgets (faithful):**
1. **KPI row (4 `KpiCard`s):** My Balance `$125,430` `+12.5%` up "compared to last month"; Net Profit `$38,700` `+8.5%` up; Expenses `$26,450` `+5.5%` up (or down per design — use up/neutral); Pending Invoices `$3,200` sublabel "3 overdue invoices" (no trend arrow, or use a warning icon).
2. **Income Sources** — card; total `$92,000` `+15.5%`; 4 category rows with `Progress`: Rental `$35,000`, Investments `$28,000`, Business `$18,000`, Freelance `$11,000` (bar sized to share of total).
3. **Monthly Expenses** — card; Recharts **area chart**, last 6 months; footer "Trending up by 5.2% this month".
4. **Expense Summary** — card; Recharts **pie/donut**: Food & Drink 48%, Grocery 32%, Shopping 13%, Transport 7% (legend).
5. **Transactions** — `Table` columns **Transaction, Date, Type (Income/Expenses badge), Amount** (green/red). 7 rows.
6. **Saving Goal** — card; `Progress` at **75%**, "$1052.98 of $1,200".
7. **My Wallet** — card; 4 payment-method rows (card brand label + masked number + balance), balances from `$2,156.89` to `$15,743.21`.

Data → `finance/data.ts`. `tsc --noEmit && pnpm build`; commit `feat: add finance dashboard`.

---

## Task 4: Smoke tests + full verification

Create `e2e/dashboards-finance.spec.ts` — per dashboard: assert status<400, no `pageerror`, and 3 exact unique widget texts visible (READ the built widgets to pick exact strings, e.g. payment: "Exchange Rates", "Convert Currencies", "Balances"; crypto: "Digital Wallets" or "Wallets", "Recent Activities", "Balance Summary"; finance: "Income Sources", "Saving Goal", "Expense Summary"). Use `getByText(t,{exact:true}).first()`. Run full suite (`CI=1`, kill :3000 first) — expect 54 prior + 3 = 57 pass; fix real render bugs at root. `pnpm lint` 0 errors. Commit `test: add finance dashboards smoke tests`.

---

## Completion Criteria
- [ ] `/dashboard/{payment,crypto,finance}` render faithful widget sets (no placeholder).
- [ ] build + lint (0 errors) + full e2e (57) green; charts no hydration errors.

**Next:** ops batch (Hotel/Hospital/Real Estate) then the rest (Project Mgmt/Analytics/File Manager/Academy).
