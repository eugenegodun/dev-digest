# CLAUDE.md — `@devdigest/web`

The studio UI. Canonical overview: [README.md](./README.md). This file is a
**map, not documentation** — non-obvious facts only; detailed docs are linked.

## Stack (versions that matter)

- Next.js 15 (App Router) · React 19 · TanStack Query · `next-intl` · `recharts`
  · `mermaid` · `react-markdown`.

## Commands

- Run: `pnpm dev` (`:3000`) · Test: `pnpm test` (vitest + jsdom) · Typecheck: `pnpm typecheck`.
- Tests mock `fetch` — **no API or browser needed**.

## Where things live

- `src/app/**/page.tsx` — routes (pages are thin).
- `src/app/**/_components/<Name>/` — colocated feature logic + its `*.test.tsx`.
- `src/lib/hooks/*` — every data hook; all calls funnel through `src/lib/api.ts`.
- `src/components/app-shell` — nav, breadcrumbs, `g`-then-key shortcuts.

## Non-default conventions

- Data flows **hooks → `api.ts`** only — components don't fetch directly.
- API base: `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`).
- Feature gating uses `useFeatureToggle`, not `localStorage`.

## Do not touch

- `messages/<locale>/*.json` — translations; don't edit directly.
- `src/vendor/ui` (`@devdigest/ui`) and `src/vendor/shared` (`@devdigest/shared`)
  — vendored; edit at source.

## More (loaded only when relevant)

- [docs/](./docs) · [specs/](./specs) · [INSIGHTS.md](./INSIGHTS.md)
- Real browser journeys live in [`../e2e`](../e2e/README.md).
- Session protocol: read [INSIGHTS.md](./INSIGHTS.md) before work here; capture
  substantial learnings at session end via the `engineering-insights` skill.
