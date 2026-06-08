# SDTPL_ADM — shadcn UI Kit Clone

Faithful clone of [shadcnuikit.com](https://shadcnuikit.com) on **Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (Base UI)**.

## Dev

```bash
pnpm dev        # run dev server (http://localhost:3000)
pnpm build      # production build (does NOT run lint)
pnpm lint       # lint (run separately)
pnpm test:e2e   # Playwright route + interaction smoke tests (runs against a production build)
```

## Structure

- `src/lib/nav.ts` — sitemap driving the sidebar + ⌘K command palette
- `src/lib/data.ts` — mock data + types
- `src/app/(dashboard)` — app-shell routes (sidebar + header)
- `src/app/(auth)` — auth routes (bare centered layout)
- `src/components/layout/` — sidebar, header, command palette, notifications, theme
- `src/components/ui/` — shadcn/ui primitives (Base UI)

## Status

**Phase 0 (Foundation)** complete: scaffold, theme (light/dark/system), app shell, ⌘K palette,
notifications, full sitemap, and placeholder pages for every route — all navigable end-to-end.
Later phases replace placeholders with real pages.

See `docs/superpowers/specs/` (design) and `docs/superpowers/plans/` (phase plans).
