# Frontend Improvement Plan — `@devdigest/web`

Analysis of `client/` against `frontend-architecture`, `react-best-practices`, and
`next-best-practices` (June 2026). Scope: front-end only. Severity uses the skills' scale
(CRITICAL / HIGH / MEDIUM). Evidence cites real paths.

## TL;DR

The data layer is genuinely good (hooks → `lib/api.ts`, pure testable helpers, colocated tests,
URL-as-state). The biggest gaps are **Next.js-shaped**: the App Router is used as a client-only SPA
(`'use client'` on ~60 files including every page), so the app forfeits RSC, server data fetching,
streaming, and route-level loading/error UI. Secondary themes: **excessive nesting + deep relative
imports**, **barrels everywhere with no bundler mitigation**, and a few **React correctness nits**.

---

## What's already good (keep doing this)

- **Single data funnel** — every fetch goes through `src/lib/hooks/*` → `src/lib/api.ts`; components
  don't fetch directly. Matches react-best-practices "all data fetching in custom hooks."
- **Pure, testable feature logic** — e.g. `FindingsPanel/helpers.ts → visibleFindings()` (filter +
  sort), no side effects.
- **Derived state done right** — `prId = pulls?.find(...)` computed during render, not stored
  (`pulls/[number]/page.tsx`). No derive-don't-store violations spotted.
- **URL-as-state** — tab/trace live in `?tab`/`?trace` search params, not component state.
- **Colocated tests** next to components; consistent scaffold.

---

## P0 — Highest impact

### 1. The App Router is a client-only SPA (HIGH, architectural)
- **Evidence:** 60 files carry `'use client'`, including **every** `page.tsx` and the root. PR-detail
  `page.tsx` (185 lines) is a client component doing data fetching, `queryClient.invalidateQueries`,
  and URL plumbing inline.
- **Why it matters** (`next-best-practices` → rsc-boundaries / data-patterns): Server Components are
  the default for a reason — less JS shipped, server-side data fetching, secrets stay server-side,
  streaming. Marking pages `'use client'` opts the whole subtree out.
- **Plan (incremental, no big-bang rewrite):**
  1. Keep pages as Server Components; push `'use client'` **down** to the leaves that actually need
     interactivity (dropdowns, drawers, forms). Start with one route (`/agents`) as a pattern.
  2. Move first-paint data fetching to the server where the data isn't user-interactive; hydrate
     TanStack Query via `dehydrate`/`HydrationBoundary` instead of fetching everything client-side.
  3. Treat this as a multi-PR migration, not a single change.
- **Effort:** L (phased). **Payoff:** smaller bundles, faster first paint, real use of the framework.

### 2. No route-level `loading` / `error` / Suspense boundaries (HIGH)
- **Evidence:** no `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere; only the root `layout.tsx`.
  Loading/empty states are hand-rolled inside client pages (`Skeleton` in `pulls/page.tsx`).
- **Why** (`next-best-practices` → error-handling, suspense-boundaries; react-best-practices → error
  boundaries): framework `loading.tsx` gives instant navigation feedback; `error.tsx` is a real
  React error boundary per segment (with reset). Hand-rolled states miss thrown errors and route
  transitions.
- **Plan:** add `loading.tsx` + `error.tsx` per top route group (`repos`, `agents`, `settings`),
  with a "Try again" reset. Pair with the P0.1 server migration.
- **Effort:** M. **Payoff:** resilience + perceived performance.

---

## P1 — Structure & bundle

### 3. Deep nesting + deep relative imports (HIGH, maintainability)
- **Evidence:** up to **6 component levels / 11 path segments**
  (`app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/TraceSection/`).
  **49** imports climb `../` ≥3 levels (e.g. `pulls/[number]/page.tsx` imports
  `../../../../../components/app-shell` and `../../../../../lib/hooks`) — **even though the `@/*`
  alias exists and is used elsewhere** (`@/components/repo-not-found`).
- **Why** (`frontend-architecture` → shallow nesting; principle 5): deep trees + relative chains make
  files hard to move and read; inconsistent import style is a smell.
- **Plan (cheap, high-value):**
  1. Codemod all `../../..`-style imports to `@/…`. Add an ESLint rule banning `../../` (force `@/`).
  2. Flatten the `RunTraceDrawer/_components/*` cluster — it's deep enough to justify promoting
     `RunTraceDrawer` to a top-level feature folder.
- **Effort:** S (import codemod) + M (flatten). **Payoff:** navigability, fewer broken-move diffs.

### 4. Barrels in every folder, no bundler mitigation (MEDIUM→HIGH for build perf)
- **Evidence:** **45** `index.ts` barrels (one per component folder); `next.config.mjs` has **no
  `optimizePackageImports`**.
- **Why** (`frontend-architecture` → barrel files; `next-best-practices` → bundling): per-folder
  re-export barrels hurt tree-shaking and slow dev/test builds.
- **Plan:** (a) add `experimental.optimizePackageImports` for `lucide-react`, `recharts`,
  `react-markdown`, `@devdigest/ui`; (b) decide a barrel policy — keep them as the "public API" per
  component but stop importing *through* a barrel from within the same folder; drop trivial
  single-export `index.ts` files in favor of direct imports.
- **Effort:** S (config) + M (policy cleanup). **Payoff:** faster builds, smaller bundles.

### 5. Heavy client libs not code-split (MEDIUM→HIGH)
- **Evidence:** `MermaidDiagram.tsx` imports `mermaid` (very large) directly; `recharts` likewise; no
  `next/dynamic` anywhere.
- **Why** (`next-best-practices` → bundling; react-best-practices → lazy loading): mermaid/recharts
  belong behind `next/dynamic(..., { ssr: false })` so they don't bloat the initial bundle.
- **Plan:** lazy-load `MermaidDiagram` and the recharts-based charts via `next/dynamic` with a small
  fallback.
- **Effort:** S. **Payoff:** meaningful initial-bundle reduction.

### 6. Naming inconsistency for component folders (MEDIUM)
- **Evidence:** shared components mix cases — `diff-viewer/`, `app-shell/`, `page-shell/`,
  `repo-not-found/` (kebab) vs `RunCostBadge/` (Pascal); route `_components` are Pascal
  (`FindingCard/`, `RunTraceDrawer/`).
- **Why** (`frontend-architecture` → naming; the meta-rule "pick one and apply everywhere").
- **Plan:** choose one (recommend: PascalCase folder per component to match the file, OR kebab-case
  throughout) and codemod. Document it in `client/CLAUDE.md`.
- **Effort:** S. **Payoff:** consistency.

---

## P2 — React correctness & modernization

### 7. Array index used as `key` on sorted/filtered lists (audit; CRITICAL where it bites)
- **Evidence:** `key={i}` in `DiffViewer` (files), `FileCard` (rows), `TraceBody` (`tool_calls`),
  `PromptModalBody`. Skeleton lists with `key={i}` are fine.
- **Why** (react-best-practices → key prop patterns): index keys break reconciliation when a list
  **reorders/filters**. **Findings are sorted by severity** (`visibleFindings`) — any index-keyed
  findings list is a real bug risk; verify `FindingsPanel`/`FindingCard` use a stable id.
- **Plan:** audit each mapped list; switch to a stable id (`finding.id`, `file.path`, `run_id`) where
  the list can change order/membership; leave static skeletons as-is.
- **Effort:** S. **Payoff:** correctness.

### 8. Styling via inline `style={}` objects instead of Tailwind (MEDIUM — conscious trade-off)
- **Evidence:** every component pairs with a `styles.ts` exporting `CSSProperties` objects/factories
  (`FindingCard/styles.ts`), applied as `style={s.x}`. Tailwind v4 **is installed** but largely unused
  for layout.
- **Why** (react-best-practices → Tailwind: no inline `style={}` objects): inline style objects can't
  express media queries / pseudo-states cleanly, and factory styles (`s.card(...)`) allocate per
  render. **This is clearly a deliberate, consistent system**, so treat as a discussion, not a defect.
- **Plan:** decide intentionally — either (a) formally bless the `styles.ts` system and document why,
  or (b) migrate to Tailwind utilities incrementally. Don't half-migrate. Note the CSS-variable
  theming (`var(--accent)`) is good either way.
- **Effort:** N/A (decision) or L (migration). **Payoff:** alignment / maintainability.

### 9. React 19 present, React Compiler not enabled (MEDIUM)
- **Evidence:** React 19, but **19 `useCallback` + 6 `useMemo`** hand-written; no `React.memo`.
- **Why** (react-best-practices → React 19 patterns): with the React Compiler enabled, most manual
  memoization is unnecessary and can be removed.
- **Plan:** evaluate `babel-plugin-react-compiler` / Next's compiler flag; once on, delete manual
  memo that wasn't profiling-driven.
- **Effort:** M (eval + rollout). **Payoff:** less code, fewer footguns.

### 10. Minor: env handling (MEDIUM-LOW)
- **Evidence:** `next.config.mjs` re-exposes `NEXT_PUBLIC_API_BASE` via the `env:` block (redundant —
  `NEXT_PUBLIC_*` is auto-exposed); `lib/api.ts` reads `process.env` directly.
- **Plan:** drop the `env:` block; centralize env access in a tiny `src/config/` module
  (`frontend-architecture` → config/). **Effort:** S.

---

## Conscious choices NOT to "fix" blindly

- **No `src/features/`, route-colocation via `_components/`** — this is one of Next.js's three
  endorsed strategies and is applied consistently. The problem isn't the strategy, it's the *depth*
  (P1.3). Only adopt `src/features/` if the team wants the ESLint-enforced boundaries.
- **`helpers.ts` per folder** — the skill discourages a *top-level* `helpers/`, but these are
  feature-local pure functions, which is fine. No action.
- **Fixed per-folder scaffold** (`constants/helpers/styles/index`) — over-ceremony for tiny files vs
  the skill's "file-first" lean, but consistency has real value here. Low priority; relax only if it
  becomes friction.

---

## Suggested sequencing

1. **Quick wins first (1 PR):** P1.3 import codemod (`@/`), P1.4 `optimizePackageImports`, P1.5
   dynamic-import mermaid/recharts, P2.10 env. Low risk, immediate build/bundle payoff.
2. **Correctness (1 PR):** P2.7 key audit.
3. **Consistency (1 PR):** P1.6 folder naming codemod + document in `client/CLAUDE.md`.
4. **The big one (phased, multiple PRs):** P0.1 RSC migration + P0.2 loading/error boundaries,
   one route group at a time, starting with `/agents`.
5. **After RSC lands:** P2.9 React Compiler eval; P2.8 styling decision.
