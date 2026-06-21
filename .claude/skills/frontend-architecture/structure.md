# Reference Structure & Next.js Mapping

Full reference layouts, the ESLint boundary config, and how the feature architecture maps onto the
Next.js App Router. Back to the rules: [SKILL.md](SKILL.md).

## 1. Full reference layout (React SPA or Next.js with `src/`)

```
src/
├── app/                      # entry (SPA) OR Next.js App Router (routing only)
├── assets/                   # imported static files (svg, fonts)
├── components/
│   ├── ui/                   # generic primitives: Button, Modal, Card, Input
│   ├── form/                 # form controls
│   └── layout/               # Header, Footer, Sidebar, PageShell
├── config/                   # env access, feature flags, app-wide config
├── features/
│   ├── billing/
│   │   ├── api/              # get-invoices.ts, useInvoices.ts (query/mutation hooks)
│   │   ├── components/       # InvoiceTable.tsx, InvoiceRow.tsx
│   │   ├── hooks/            # useInvoiceFilters.ts
│   │   ├── stores/           # billing client state
│   │   ├── utils/            # feature-local helpers
│   │   ├── types/            # invoice.types.ts
│   │   ├── constants.ts
│   │   └── index.ts          # PUBLIC API — the only barrel
│   └── auth/
│       └── ...
├── hooks/                    # app-wide reusable hooks: useMediaQuery, useDebounce
├── lib/                      # api-client.ts (configured axios), query-client.ts, storage.ts
├── stores/                   # global client state (theme, session)
├── testing/                  # test utils, render helpers, mocks, fixtures
├── types/                    # truly shared types
└── utils/                    # generic pure fns: format-date.ts, slugify.ts, clamp.ts
```

**Maturation path** (don't build all of this on day one):
single file → files → folder-per-component → technical folders (`hooks/`, `utils/`) →
`features/` (around 10+ components) → domain grouping (20+ features) → monorepo packages (multi-app).

## 2. ESLint dependency-boundary enforcement

Enforce `shared → features → app` and "no cross-feature imports" mechanically:

```js
// eslint config
'import/no-restricted-paths': ['error', {
  zones: [
    // 1) a feature cannot import from another feature
    {
      target: './src/features/billing',
      from: './src/features',
      except: ['./billing'],
    },
    // (repeat per feature, or generate)

    // 2) shared layers cannot import from features or app
    {
      target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils'],
      from: ['./src/features', './src/app'],
    },

    // 3) features cannot import from app
    {
      target: './src/features',
      from: './src/app',
    },
  ],
}]
```

Pair with `eslint-plugin-import` for ordering and `no-restricted-imports` to block deep imports
into a feature (force imports through `features/<f>/index.ts`).

## 3. Next.js App Router mapping

Next.js is unopinionated; a route becomes public ONLY when a `page`/`route` file exists, so other
files in a segment are safe to colocate. Three official strategies — pick one:

1. **Code outside `app/` (recommended for feature architecture):** `app/` holds only routing files;
   all real code lives in `src/features`, `src/components`, `src/lib`. Pages import from features.
2. **Code in top-level folders inside `app/`.**
3. **Split by feature/route:** shared code at root, route-specific code colocated in its segment.

### Thin page → feature (strategy 1)

```
src/app/(dashboard)/billing/page.tsx     # ~20 lines: fetch + render feature component
src/features/billing/...                 # all the logic
```

```tsx
// app/(dashboard)/billing/page.tsx — routing layer only
import { getInvoices } from '@/features/billing/api/get-invoices'
import { InvoiceTable } from '@/features/billing'   // via feature's public index.ts

export default async function BillingPage() {
  const invoices = await getInvoices()      // Server Component data fetch
  return <InvoiceTable invoices={invoices} />
}
```

### Colocation with private folders (strategy 3)

```
app/blog/
├── page.tsx
├── _components/PostCard.tsx     # _ = opted out of routing, never a URL
└── _lib/get-posts.ts
```

### Routing primitives (see next-best-practices for full detail)

- Special files: `layout`, `page`, `loading`, `error`, `not-found`, `route`, `template`, `default`.
- **Route groups** `(group)` — organize / scope layouts without affecting the URL; enable multiple
  root layouts.
- **Private folders** `_folder` — opt a folder + children out of routing for safe colocation.
- **`src/` folder** — separates app code from root config; recommended for larger apps.

## 4. Decision flowchart: "where does this code go?"

```
Is it a React component?
├─ used by 1 feature?      → features/<f>/components/
└─ generic/reusable?       → components/ui|form|layout/

Is it logic (a function)?
├─ stateful / uses hooks?  → a custom hook (component → feature → src/hooks by reuse)
├─ does I/O or business?   → features/<f>/api/  or  services/
├─ wraps a library/browser API? → lib/
└─ pure & generic?         → utils/

Is it a value?
├─ changes at runtime, affects UI? → state (useState → store; see react-best-practices)
└─ constant?               → component/feature constants.ts → config/ (app-wide)
```
