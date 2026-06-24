---
name: frontend-architecture
description: "React + Next.js project architecture and code organization (2025-26). Use when scaffolding a frontend project, deciding WHERE code goes (components, hooks, utils, helpers, lib, services, constants, types, business logic), how to split components, how to structure features, and how dependencies should flow. Complements react-best-practices (component/hook/state anti-patterns) and next-best-practices (Next.js mechanics). Trigger terms: folder structure, project structure, where to put, file organization, feature folder, where does this go, how to split this component, architecture."
metadata:
  tags: react, nextjs, architecture, project-structure, file-organization, frontend
---

# Frontend Architecture & Code Organization

How to organize a React / Next.js (App Router) codebase: where each kind of code
lives, how to split it, and how dependencies flow. This skill answers *placement* questions.
For component/hook/state **anti-patterns** use `react-best-practices`; for Next.js
**mechanics** (RSC, routing files, data fetching, metadata) use `next-best-practices`.

For the full reference layout and the Next.js mapping see [structure.md](structure.md).
For good/bad placement examples see [examples.md](examples.md). For sources see [references.md](references.md).

## Severity Levels

- **CRITICAL** — gets the architecture fundamentally wrong; expensive to unwind later
- **HIGH** — causes scaling pain, scattered code, or coupling
- **MEDIUM** — hurts maintainability or consistency

---

## First Principles (CRITICAL)

Neither React nor Next.js prescribes a structure — both are explicitly unopinionated.
"Best practice" = community consensus + the few rules bundlers/the framework actually impose.
Five principles drive every rule below:

1. **Colocation** — keep files that change together close together.
2. **Evolve, don't over-engineer** — start minimal; promote code to a shared layer only when
   a *second* consumer appears. A single-consumer abstraction is premature.
3. **Feature-first** — top-level folders should describe what the app *does* (`features/billing`),
   not which framework primitive it uses.
4. **Unidirectional dependencies** — code flows `shared → features → app`. Features must NOT
   import from each other.
5. **Shallow nesting** — never nest more than ~2–3 levels deep.

> **The meta-rule that overrides all preferences: pick a convention and apply it everywhere.**
> Consistency beats any single "correct" layout.

---

## Where does each thing go? (CRITICAL)

This is the core decision table. "Shared" = root-level folder under `src/`. "Feature" =
inside `src/features/<feature>/`. Default to feature-local; promote to shared on 2nd use.

| Thing | Default location | Rule of thumb |
|-------|------------------|---------------|
| **UI components** | `src/components/ui/` (generic) · `src/features/<f>/components/` (domain) | Generic & reusable → shared `ui`. Tied to one feature → that feature. |
| **Business logic** | custom hooks + pure functions inside `src/features/<f>/` | NEVER in page/route components. See "Separating business logic" below. |
| **Custom hooks** | inline/`Component.hooks.ts` (1 component) · `features/<f>/hooks/` (1 feature) · `src/hooks/` (app-wide) | Promote up only on reuse. |
| **Utils** | `src/utils/` | **Generic, portable, pure** functions — string/date/number/array helpers (lodash-like). No business logic, no tech coupling. |
| **Lib** | `src/lib/` | Utilities **coupled to a technology** + pre-configured 3rd-party clients (the axios/query-client/date-lib instance, DOM/`localStorage` wrappers). |
| **Services / API** | `src/features/<f>/api/` · `src/services/` | Business/application logic + external I/O (HTTP calls, data access). |
| **"Helpers"** | feature-local only, or fold into `utils` | ⚠️ Don't create a top-level `helpers/`. "Helper" = project-specific small fn; if generic it's a util, if it does I/O it's a service. |
| **Constants** | `Component.constants.ts` (component) · `features/<f>/constants.ts` (feature) · `src/config/` (app-wide) | Enums, magic numbers, breakpoints, public keys. `UPPER_SNAKE_CASE`. |
| **Config / env** | `src/config/` | Centralize env-var access + global config here; don't read `process.env` ad hoc. |
| **Types** | colocate with component/feature · `src/types/` only if truly shared | |
| **Stores (global client state)** | `src/stores/` · `features/<f>/stores/` | See `react-best-practices` for *what* belongs in global state. |
| **Assets** | `src/assets/` (imported) · `public/` (static-served by Next.js) · `features/<f>/assets/` | |
| **Tests** | colocated `Component.test.tsx` next to the file | See `react-testing-library`. |

> **Anti-pattern (HIGH):** the 2,000-line `utils.ts`. Split utilities into small, named modules
> by concern (`utils/format-date.ts`, `utils/slugify.ts`), not one dumping ground.

### The utils / lib / services / helpers distinction (the most-confused question)

- **util** — generic & portable; would make sense in *any* project (`capitalize`, `clamp`).
- **lib** — generic but **tech-coupled**; wraps a library or browser API (`lib/api-client.ts`, `lib/storage.ts`).
- **service** — **business logic** and/or external I/O (`features/billing/api/create-invoice.ts`).
- **helper** — project-specific glue too small to be a service; keep it **feature-local** or just call it a util. Avoid it as a separate top-level concept.

---

## Reference folder structure (HIGH)

The de-facto standard (bulletproof-react): a thin shared layer + a `features/` directory holding
most code. Full version in [structure.md](structure.md).

```
src/
├── app/          # Next.js routing ONLY — thin pages that call into features/lib
├── components/   # shared components (ui/, form/, layout/)
├── config/       # global config + env access
├── features/     # ← the bulk of the app; one folder per domain
│   └── <feature>/
│       ├── api/          # data access + query/mutation hooks for this feature
│       ├── components/   # feature-scoped components
│       ├── hooks/        # feature-scoped hooks
│       ├── stores/       # feature state
│       ├── utils/        # feature-local helpers
│       ├── types/
│       └── index.ts      # the feature's PUBLIC API (the ONE allowed barrel)
├── hooks/        # app-wide shared hooks
├── lib/          # configured 3rd-party clients + tech-coupled utils
├── stores/       # global client state
├── types/        # shared types
└── utils/        # generic pure utilities
```

**Promotion rule (HIGH):** if exactly one feature uses something, it stays in that feature.
The moment a second feature needs it, it graduates up to the shared layer (`components/`, `hooks/`,
`utils/`, `lib/`). Don't pre-place code in shared "just in case."

---

## Dependency direction (CRITICAL)

Flow is one-way: **`shared → features → app`**.

- Shared code (`components`, `hooks`, `lib`, `utils`, `types`) may be imported anywhere.
- A feature may import from shared, but **NOT from another feature**. Cross-feature need = the
  shared piece belongs one layer up, OR the two features are really one.
- `app/` may import from features + shared; nothing imports from `app/`.

Enforce it with ESLint `import/no-restricted-paths` (config in [structure.md](structure.md)) so the
boundary is mechanical, not tribal knowledge.

---

## Splitting components (HIGH)

Split when a component earns it — not preemptively (`react-best-practices` caps components at
~200 lines / 5–7 props). **Signals to extract a child component:**

- it owns distinct DOM markup/styles, or "looks like" a self-contained box/section
- a repeated section (list items, cards)
- a JSX block that depends on a single input object
- a chunk with its own reason to change (single-responsibility)

**How to split:**
- prefer **composition** (`children` / slot props) over deep prop drilling
- pass a child only the props it needs
- shared state/logic → lift into a custom hook or Context, not prop chains

**Don't over-split (MEDIUM):** "you can extract it" ≠ "you must." One-off markup used once can
stay inline. Balance reuse against churn.

**Component file growth (file-first):** start as `Card.tsx`. When a *second* sibling file appears
(test, styles, types, hooks), promote to a folder:

```
Card/
├── Card.tsx
├── Card.test.tsx
├── Card.types.ts
├── Card.hooks.ts        # hooks used ONLY by Card
└── Card.constants.ts
```

---

## Separating business logic from UI (HIGH)

The modern container/presentational split = **custom hook (logic) + dumb component (view)**.

- Move data/state/side-effects/API orchestration into a custom hook (`useInvoiceList`).
- Leave the component presentational: receives data + callbacks via props, renders UI.
- Push **stateless** calculations into pure functions (`utils` / feature `utils`); keep only the
  stateful/effectful glue in the hook.
- Hook rules: one focused purpose, `use` prefix, compose small hooks, no needless deps.
- Be pragmatic — a few lines of logic don't need their own hook.

Benefits: test logic without rendering, reuse across components, change UI and logic independently.

---

## Next.js App Router placement (HIGH)

Detailed mechanics live in `next-best-practices`. Architecture rules:

- **`app/` is for routing.** No business logic or data fetching in page components beyond calling
  a function from `features/` or `lib/`. A page should be readable in ~30 seconds.
- Keep real code in `src/features/` and import into thin route files (preferred), OR colocate
  inside route segments using **private folders** (`app/blog/_components`, `app/blog/_lib`) which
  are opted out of routing. Pick one approach and be consistent.
- Use **route groups** `(group)` to organize routes / scope layouts without changing URLs.
- **Server Components by default**; add `'use client'` only for interactivity/state/browser APIs,
  and push it as deep in the tree as possible. (Full rules: `next-best-practices` → rsc-boundaries.)

---

## Naming conventions (MEDIUM)

- **Components:** `PascalCase`, file matches (`LoginForm.tsx`).
- **Hooks:** `useThing` (camelCase, `use` prefix).
- **Functions / variables:** `camelCase`.
- **Constants / enums:** `UPPER_SNAKE_CASE`.
- **Folders & non-component files:** `kebab-case` (`format-date.ts`, `user-profile/`) — avoids
  cross-OS case-sensitivity bugs and reads consistently with tooling.
- **Match folder + file names** within a component folder (`Card/Card.tsx`, `Card/Card.test.tsx`).

---

## Barrel files (`index.ts` re-exports) (HIGH)

Barrels are convenient but hurt tree-shaking, inflate bundles, and slow dev/test builds because the
bundler parses the whole graph for one import.

- **Allowed:** ONE barrel per feature as its public API (`features/<f>/index.ts`). This is what
  enforces the "import features through their front door" boundary.
- **Avoid:** deep/global barrels and re-export chains (`components/index.ts` re-exporting everything).
- In Next.js, enable **`optimizePackageImports`** in `next.config.js` for any barrels you keep.
- Inside a feature, prefer **direct imports** between files over going through the barrel.

---

## Project conventions chosen here (adjust per team)

These resolve the genuinely-contested questions. Flip them in this file if the team disagrees —
just keep them consistent everywhere:

1. **No top-level `helpers/`** — generic → `utils/`, tech-coupled → `lib/`, business → service/feature.
2. **kebab-case** for non-component files/folders; PascalCase for components.
3. **Barrels:** one per feature (public API) only; `optimizePackageImports` on; no deep/global barrels.
4. **`src/features/`** holds the code; `app/` stays a thin routing layer.
5. **Component file-first:** single `.tsx` until a 2nd sibling file appears, then promote to a folder.

---

## Related skills

- **react-best-practices** — component purity, hooks misuse, derive-don't-store, memoization, keys,
  conditional rendering, a11y. (The "is this code correct?" layer.)
- **next-best-practices** — RSC boundaries, routing files, data patterns, metadata, images/fonts.
- **react-testing-library** — how to test the components this structure produces.
- **typescript-expert** — advanced typing for the props/types this skill places.
