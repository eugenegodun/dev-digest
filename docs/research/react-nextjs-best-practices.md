# React + Next.js Best Practices — Research Notes (for a future skill)

> Research compiled June 2026. Targets **React 19** and **Next.js 15/16 (App Router)**.
> This is a sourced reference, not the skill itself. Every claim links to its source so we
> can quote/verify when authoring the skill. Where sources disagree, the disagreement is noted.

---

## 0. How to read this

The ecosystem has **no single official folder structure** — React and Next.js are both
explicitly unopinionated ([React docs via Tania Rascia](https://www.taniarascia.com/react-architecture-directory-structure/),
[Next.js: "Next.js is unopinionated about how you organize and colocate your project files"](https://nextjs.org/docs/app/getting-started/project-structure)).
So "best practice" here means **strong community consensus** + the few hard rules the
frameworks/bundlers actually impose. The single most repeated meta-rule across every source:

> **Pick a structure, then be consistent.** Consistency beats any particular layout.
> — recurring in [Next.js docs](https://nextjs.org/docs/app/getting-started/project-structure),
> [React naming conventions](https://www.sufle.io/blog/naming-conventions-in-react),
> [Wisp CMS Next.js guide](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure).

---

## 1. Guiding principles (the "why" behind every rule below)

1. **Colocation** — keep files that change together close together. React's own guidance:
   "keep files that often change together close to each other."
   [React folder structure (Tania Rascia)](https://www.taniarascia.com/react-architecture-directory-structure/) ·
   [Josh W. Comeau – Delightful File Structure](https://www.joshwcomeau.com/react/file-structure/) ·
   [Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)
2. **Evolve the structure; don't over-engineer up front.** Start with a single file →
   split into files → folders-per-component → technical folders → feature folders → domains →
   monorepo. Promote things only when the codebase asks for it.
   [Robin Wieruch – React Folder Structure](https://www.robinwieruch.de/react-folder-structure/)
3. **Feature-first / "screaming architecture"** — the top-level folders should tell you what
   the app *does*, not what framework it uses.
   [bulletproof-react project-structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) ·
   [profy.dev – Screaming Architecture](https://profy.dev/article/react-folder-structure)
4. **Unidirectional dependencies.** Code flows `shared → features → app`. Shared code may be
   used anywhere; features may import only from shared; app may import from features + shared;
   **features must not import from each other.**
   [bulletproof-react project-structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
5. **Keep nesting shallow.** Never nest more than ~2–3 levels; deep trees make imports and
   file moves painful.
   [Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) ·
   [Netguru](https://www.netguru.com/blog/react-project-structure) ·
   [dev.to – Next.js 15 structure that scales](https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha)
6. **Single Responsibility** at every level — one component / hook / module = one reason to change.
   [Kent C. Dodds – When to break up a component](https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components) ·
   [Guidelines from the 1970s on splitting components](https://dev.to/imforja/guidelines-from-the-1970s-on-how-to-split-your-react-components-2jn5)

---

## 2. Folder structure: the two axes (and the recommended hybrid)

**Two organizing strategies** the whole debate reduces to
([dev.to – Folder Structures in React](https://dev.to/itswillt/folder-structures-in-react-projects-3dp8),
[profy.dev](https://profy.dev/article/react-folder-structure)):

- **By type / "technical"** — `components/`, `hooks/`, `utils/`, `services/`. Fine for small apps;
  breaks down at scale because one feature's code is scattered across every folder.
- **By feature / domain** — `features/auth/`, `features/dashboard/`, each holding its own
  components/hooks/api/etc. Scales; preferred for medium-large apps.

**Recommended hybrid** (the de-facto community standard, codified by bulletproof-react):
a thin shared/technical layer at the root **plus** a `features/` directory that holds the bulk
of the code.

### bulletproof-react reference layout
[Source](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)

```
src/
├── app/          # routes, app entry, providers, router config
├── assets/       # static files (images, fonts)
├── components/   # shared components used across the whole app
├── config/       # global config, env vars
├── features/     # feature modules — the primary unit of organization
├── hooks/        # shared hooks used app-wide
├── lib/          # reusable, pre-configured 3rd-party libraries
├── stores/       # global state stores
├── testing/      # test utils, mocks
├── types/        # shared TypeScript types
└── utils/        # shared utility functions
```

Each **feature** mirrors a mini-app and contains only what it needs:

```
src/features/awesome-feature/
├── api/          # API request declarations + data-fetching hooks for this feature
├── assets/
├── components/   # feature-scoped components
├── hooks/        # feature-scoped hooks
├── stores/       # feature state
├── types/
└── utils/
```

**Rule:** if exactly one feature uses something, it lives in that feature; once two+ features
need it, it graduates up to the shared layer.
[Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) ·
[Wisp CMS](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure)

### Enforcing the boundaries (ESLint)
bulletproof-react enforces the unidirectional rule with `import/no-restricted-paths` —
worth stealing for the skill ([source](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)):

```js
'import/no-restricted-paths': ['error', { zones: [
  // features can't import from each other
  { target: './src/features/feature-a', from: './src/features', except: ['./feature-a'] },
  // app can't be imported by features; shared can't import from features/app
  { target: './src/features', from: './src/app' },
  { target: ['./src/components','./src/hooks','./src/lib','./src/types','./src/utils'],
    from: ['./src/features','./src/app'] },
]}]
```

---

## 3. Where exactly does each thing go?

This directly answers the questions in the brief. Consensus distinctions
([Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/),
[dev.to – Folder Structures](https://dev.to/itswillt/folder-structures-in-react-projects-3dp8),
[React handbook](https://reacthandbook.dev/project-standards)):

| Thing | Where it goes | Definition / rule |
|-------|---------------|-------------------|
| **Components** | `components/ui/` (buttons, modals, cards), `components/form/` (inputs); feature-specific ones in `features/<f>/components/` | Shared/generic vs feature-scoped. Promote to shared only when reused. |
| **Utils** | `utils/` | **Generic, app-agnostic** pure functions — string/number/date helpers, like lodash. No business logic, no framework/tech coupling. |
| **Lib** | `lib/` | Utilities **coupled to a technology**: DOM/localStorage/IndexedDB wrappers, and pre-configured 3rd-party clients (axios instance, query client, date lib config). |
| **Helpers** | usually inside the feature, or `utils/helpers/` | **Project/business-specific** small functions that wouldn't make sense to share across projects. (Key distinction: util = generic & portable; helper = specific to *this* app.) [Source](https://www.robinwieruch.de/react-folder-structure/) |
| **Services** | `services/` (or `features/<f>/api/`) | Encapsulate **business/application logic** and external API access. |
| **Business logic** | custom hooks + pure functions, in `features/<f>/` (hooks/, api/, utils/) — **never** in page/route components | Extract into custom hooks (stateful) + pure functions (stateless). See §8. |
| **Constants** | component-level → next to the component; feature-level → `features/<f>/constants.ts`; app-wide → `config/` or root `constants.ts` | e.g. `export const MINUTES_PER_HOUR = 60`; colors, breakpoints, public keys, enums. [Source](https://www.robinwieruch.de/react-folder-structure/) |
| **Config / env** | `config/` | Global configuration + environment variable access centralized here. [bulletproof-react] |
| **Custom hooks** | component-only → `component/hooks.ts` or inline; feature → `features/<f>/hooks/`; app-wide → `hooks/` | Promote up only when reused. [Robin Wieruch] |
| **Types** | shared → `types/`; otherwise colocated with the component/feature | [bulletproof-react] |
| **Assets** | global → `assets/`; feature → `features/<f>/assets/`; static-served → Next.js `public/` | |

> ⚠️ **utils vs helpers vs lib** is the single most-asked and most-inconsistently-answered
> question. Many teams collapse `helpers` into `utils`. The skill should pick **one** clear
> definition and enforce it. The cleanest split found:
> **utils = generic/portable**, **lib = tech-coupled**, **services = business logic + I/O**,
> and drop "helpers" as a separate concept (or scope it strictly to feature-local).
> [Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) ·
> [dev.to – Folder Structures](https://dev.to/itswillt/folder-structures-in-react-projects-3dp8)

> **Anti-pattern:** the 2,000-line `utils.ts`. Break utilities into logical, named modules.
> [dev.to – Next.js 15 best practices](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)

### Component-level colocation
A component folder scales horizontally as it grows
([Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/),
[Josh Comeau](https://www.joshwcomeau.com/react/file-structure/)):

```
Button/
├── Button.tsx
├── Button.test.tsx
├── Button.module.css      # or Tailwind, no file
├── Button.types.ts
├── Button.hooks.ts        # hooks used ONLY by this component
└── Button.constants.ts
```

---

## 4. Component design & when to split

**Reasons to split** ([Medium – Splitting Components](https://thiraphat-ps-dev.medium.com/splitting-components-in-react-a-path-to-cleaner-and-more-maintainable-code-f0828eca627c),
[Six Pillars of Component Architecture](https://medium.com/@abbas-roholamin/splitting-a-ui-into-components-in-react-six-pillars-of-component-architecture-04538e542ce5)):
readability, reuse, testability, and avoiding whole-subtree re-renders from one state change.

**Signals that a chunk should become its own component**
([frontarm – How should I separate components](https://frontarm.com/james-k-nelson/how-should-i-separate-components/)):
- it has its own DOM markup/styles,
- repeated sections (list items),
- it "looks like" a box/section,
- a JSX section depends on a single input object.

**Decomposition techniques** — extract by responsibility, lift/pass via props, use composition
(`children`) over deep prop chains
([David Tang – Decomposing React components](https://medium.com/dailyjs/techniques-for-decomposing-react-components-e8a1081ef5da)).

**Pass only the props a component needs**; lift shared state to Context or a custom hook
instead of prop-drilling
([Medium – Splitting Components](https://thiraphat-ps-dev.medium.com/splitting-components-in-react-a-path-to-cleaner-and-more-maintainable-code-f0828eca627c)).

**Important caveat (don't over-split):** "Just because you can factor something out doesn't
mean you must." Balance maintainability against churn.
[Kent C. Dodds – When to break up a component](https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components) ·
[Guidelines from the 1970s (coupling/cohesion)](https://joaoforja.com/blog/guideline-on-how-to-decompose-a-react-component)

**Container/Presentational** is now expressed as **custom-hook (logic) + dumb component (view)**
rather than the old class pattern — see §8.

---

## 5. Server vs Client Components (Next.js App Router)

Hard framework rules + consensus
([Next.js – Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components),
[Next.js – use client directive](https://nextjs.org/docs/app/api-reference/directives/use-client),
[dev.to – Decision Framework](https://dev.to/whoffagents/react-server-components-vs-client-components-the-decision-framework-for-nextjs-14-2j67)):

- **Server Components are the default.** Prefer them — less JS shipped, faster, can hold secrets.
- **Use Server Components for:** data fetching (DB/API directly), secrets/API keys, heavy deps,
  static/async content, non-interactive UI.
- **Add `'use client'` only when you need:** event handlers (`onClick`/`onChange`), state/effects
  (`useState`/`useReducer`/`useEffect`), browser APIs (`window`, `localStorage`), or client-only
  libs (charts, maps, animation, realtime).
- **Push `'use client'` as deep as possible** — don't make a whole page a Client Component for
  one interactive button. Keep the tree mostly server-rendered.
- **Composition rule:** you can nest Client Components inside Server Components, **not** the other
  way around. Pass Server Components into Client ones via `children`/props.

---

## 6. Next.js App Router structure specifics
[Source: Next.js – Project structure & organization](https://nextjs.org/docs/app/getting-started/project-structure)

- **`src/` folder** (optional): separates app code from root config files. Recommended for larger apps.
- **Special files:** `layout`, `page`, `loading`, `error`, `global-error`, `not-found`, `route`
  (API), `template`, `default`. Render hierarchy: `layout → template → error → loading → not-found → page`.
- **Route groups `(group)`** — organize routes (by section/team) and create per-section layouts
  **without** affecting the URL. Enable multiple root layouts.
- **Private folders `_folder`** — opt a folder (and children) out of routing; use for colocated
  components/utils/logic that shouldn't be routable (`app/blog/_components`, `app/blog/_lib`).
- **Colocation is safe by default** — a route is only public when it has `page`/`route`; other
  files in the segment are never served. So you *can* keep feature code right inside `app/`.
- **Three official strategies** (pick one, be consistent):
  1. **Store project files outside `app/`** — `app/` is routing-only; code lives in root `components/`, `lib/`, etc.
  2. **Store them in top-level folders inside `app/`**.
  3. **Split by feature/route** — shared code at the root, specific code colocated in its route segment.

**Community guidance layered on top**
([Wisp CMS](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure),
[dev.to – structure that scales](https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha),
[dev.to – best practices 2025](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)):
- **No business logic or data fetching in `app/` pages** beyond calling a function from
  `features/` or `lib/`. A page file should be readable in ~30 seconds.
- Feature modules (`features/auth/components/`) are importable only by their own routes + root layout.
- Keep route folders shallow.

---

## 7. State management & data fetching (2025)
[Developer Way – React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025) ·
[Makers' Den](https://makersden.io/blog/react-state-management-in-2025) ·
[Medium – Zustand + React Query](https://medium.com/@freeyeon96/zustand-react-query-new-state-management-7aad6090af56)

**The core principle: separate _server state_ from _client state_.** They are fundamentally
different — client state lives in the app; server state lives remotely and needs async access,
caching, and sync.

**Decision ladder:**
1. **Local UI state →** `useState` / `useReducer`. Start here; only lift when genuinely shared.
2. **Shared client state →** Context for low-frequency/global (theme, auth user), **Zustand**
   (or Jotai) for app-wide client state without boilerplate. Avoid Context for high-frequency
   updates (re-render cost).
3. **Server state →** **TanStack Query (React Query)** or **SWR** — caching, background refetch,
   optimistic updates, dedup. **Don't** hand-roll server state with `useState` + `useEffect`.
4. Most production apps **combine** these (React Query for server data + Zustand/Context for
   client) rather than one global store for everything.

In Next.js App Router, also prefer **fetching on the server** (Server Components / Server Actions)
where possible, reserving client data libraries for interactive/realtime client state.

---

## 8. Separating business logic from UI (custom hooks)
[eMoosavi – Decoupling with custom hooks](https://www.emoosavi.com/blog/decoupling-business-logic-from-ui-with-custom-react-hooks) ·
[Felix Gerschau – Separation of concerns with hooks](https://felixgerschau.com/react-hooks-separation-of-concerns/) ·
[Medium – Separating business logic from UI in React 18](https://medium.com/design-bootcamp/separating-%EF%B8%8F-business-logic-from-ui-components-in-react-18-aa1775b3caba)

- Identify the parts of a component that manage data/state/side-effects/API calls and move them
  into **custom hooks**; leave the component as a "dumb"/presentational view that takes data +
  callbacks via props.
- Benefits: independent testing of logic, reuse across components, change logic without touching UI.
- **Custom hooks rules:** one focused purpose, name starts with `use`, compose small hooks into
  bigger ones, avoid unnecessary deps.
- **Be pragmatic** — a few lines of logic don't need their own hook.
- Push pure, stateless calculations into **plain pure functions** (in `utils`/feature `utils`),
  and keep only the stateful/effectful glue in the hook.

---

## 9. Naming conventions
[sufle.io](https://www.sufle.io/blog/naming-conventions-in-react) ·
[Faraz – Opinionated folder structure & naming](https://dev.to/farazamiruddin/an-opinionated-guide-to-react-folder-structure-file-naming-1l7i) ·
[handsonreact](https://handsonreact.com/docs/code-organization-conventions) ·
[koistya gist](https://gist.github.com/koistya/d7a507438c741ee6adb5)

- **Components:** `PascalCase` (both the component and its file): `LoginForm.tsx`.
- **Hooks:** `useSomething` (camelCase, `use` prefix).
- **Functions/variables:** `camelCase`.
- **Constants:** `UPPER_SNAKE_CASE` for true constants/enums.
- **Folders / non-component files:** two camps — `camelCase` **or** `kebab-case`. kebab-case is
  common across JS/TS tooling and avoids case-sensitivity bugs across OSes; PascalCase reserved
  for class/interface/component definitions.
- **Match folder + file names** within a component folder (`Card/Card.tsx`, `Card/Card.test.tsx`,
  `Card/Card.styles.ts`).
- **The real rule:** React has no official convention — choose one and apply it everywhere.

---

## 10. TypeScript patterns
[LogRocket – 10 React+TS patterns](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/) ·
[typescript-cheatsheets/react](https://github.com/typescript-cheatsheets/react) ·
[Steve Kinney – Component props complete guide](https://stevekinney.com/courses/react-typescript/component-props-complete-guide)

- **`"strict": true`** in tsconfig; avoid `any`, type explicitly.
- Type props with `interface`/`type`; make required vs optional explicit (`?`), provide defaults.
- Use **discriminated unions** to model mutually-exclusive states (loading/error/success), making
  invalid states unrepresentable.
- Use **React utility types** (`ComponentProps`, `PropsWithChildren`, `Ref` helpers) instead of
  re-deriving; use **generics** for reusable components (e.g. a typed `<Select<T>>`).
- "Good prop types tell a story — make the happy path obvious and the wrong path impossible."
- Prop spreading/forwarding is useful but keep it intentional (don't blindly spread `...props`).

---

## 11. Performance
[Strapi – React.memo 2025 guide](https://strapi.io/blog/react-memo-optimize-functional-components-guide) ·
[DebugBear – useMemo/useCallback](https://www.debugbear.com/blog/react-usememo-usecallback) ·
[React Compiler / React 19](https://isitdev.com/react-19-compiler-usememo-usecallback-dead-2025/) ·
[Growin – Performance 2025](https://www.growin.com/blog/react-performance-optimization-2025/)

- **React 19 Compiler** auto-memoizes pure components/values — manual `useMemo`/`useCallback`/
  `React.memo` become largely unnecessary once it's enabled. Going forward, **don't pre-optimize**.
- Without the compiler: `React.memo` (shallow prop compare), `useMemo` (values), `useCallback`
  (function identity) — but only after **profiling** confirms a real problem (Kent C. Dodds:
  misuse costs more than it saves). Memoizing trivial components is counterproductive.
- Keep referential stability for props passed to memoized children (wrap objects/callbacks).
- Other levers: `React.lazy` + dynamic imports (code splitting), scope Context narrowly,
  `useTransition`/`useDeferredValue` for responsiveness, **virtualize long lists**, stable unique
  `key` props.

---

## 12. Testing organization
[Next.js – Testing with Vitest](https://nextjs.org/docs/app/guides/testing/vitest) ·
[Makers' Den – RTL + Vitest](https://makersden.io/blog/guide-to-react-testing-library-vitest) ·
[Incubyte – Vitest + RTL](https://blog.incubyte.co/blog/vitest-react-testing-library-guide/)

- **Two layouts, both accepted:** colocate `Component.test.tsx` next to the component
  (preferred — matches colocation principle), **or** a `__tests__/` folder. Vitest picks up
  `*.test.*` / `*.spec.*` anywhere.
- **Test behavior, not implementation** — query the way users do (accessible/role queries via
  React Testing Library); this also improves accessibility.
- One assertion focus per test; extract shared setup into fixtures/helpers (`testing/` dir in
  bulletproof-react).

---

## 13. Barrel files (`index.ts` re-exports) — the 2025 caution
[Next.js discussion #92926](https://github.com/vercel/next.js/discussions/92926) ·
[Catch Metrics – barrel bundle size](https://www.catchmetrics.io/blog/nextjs-bundle-size-improvements-optimize-your-performance) ·
[The Barrel Trap](https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872) ·
[Why I won't use index files in 2025](https://medium.com/@aleksandr_ross/why-i-will-not-use-index-files-in-2025-b40db08dab00)

- Barrel files give a clean "public API" per module (bulletproof-react uses them) **but** can
  hurt tree-shaking, balloon bundles (reported 12×: 145KB vs 12KB), and slow dev builds/test
  runs because the bundler must parse the whole graph for one import.
- **Recommendations:** prefer **direct imports** in large/perf-sensitive apps; if you use
  barrels, lean on Next.js **`optimizePackageImports`** in `next.config.js` to mitigate. Decide
  deliberately — this is the one place the "tidy `index.ts`" habit has a real cost.

---

## Open decisions for the skill (where sources conflict — we must choose)

1. **`helpers` as a concept** — keep it (feature-local only) or fold into `utils`? (Lean: fold in.)
2. **File/folder casing** — `kebab-case` vs `camelCase` for non-components. (Lean: kebab-case.)
3. **Barrel files** — allow per-feature `index.ts` (bulletproof-react) or ban them (perf camp)?
   (Lean: allow feature-level, ban deep/global barrels, enable `optimizePackageImports`.)
4. **`features/` vs Next.js `app/` colocation** — do features live in `src/features/` or inside
   `app/` route segments / `_folder`s? (Lean: `src/features/` + thin `app/` for routing.)
5. **Component colocation depth** — single `Component.tsx` until it grows, vs always a folder.
   (Lean: file-first, promote to folder when 2nd sibling file appears.)

---

## Full source list (grouped)

### Folder structure / project organization
- [bulletproof-react – project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — **primary reference**
- [Robin Wieruch – React Folder Structure (2026)](https://www.robinwieruch.de/react-folder-structure/) — **evolutionary model + utils/lib/helpers split**
- [Josh W. Comeau – Delightful React File Structure](https://www.joshwcomeau.com/react/file-structure/)
- [Tania Rascia – Structure & organize a React app](https://www.taniarascia.com/react-architecture-directory-structure/)
- [dev.to – Folder Structures in React Projects](https://dev.to/itswillt/folder-structures-in-react-projects-3dp8)
- [profy.dev – Folder structures & Screaming Architecture](https://profy.dev/article/react-folder-structure)
- [React Handbook – Project Standards](https://reacthandbook.dev/project-standards)
- [Web Dev Simplified – React folder structure](https://blog.webdevsimplified.com/2022-07/react-folder-structure/)
- [Netguru – Professional React project structure](https://www.netguru.com/blog/react-project-structure)
- [dev.to – Recommended folder structure for React 2025](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)

### Next.js App Router
- [Next.js docs – Project structure & organization](https://nextjs.org/docs/app/getting-started/project-structure) — **official**
- [Next.js docs – Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — **official**
- [Next.js docs – `use client` directive](https://nextjs.org/docs/app/api-reference/directives/use-client) — **official**
- [Next.js docs – Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) — **official**
- [Wisp CMS – Organizing your Next.js 15 project](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure)
- [dev.to – Best practices for organizing Next.js 15 (2025)](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)
- [dev.to – The Next.js 15 App Router structure that scales](https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha)
- [Dr. Shahin Siami – Structure, routing, layouts, file conventions](https://shahin.page/article/nextjs-project-structure-routing-layouts-file-conventions)
- [dev.to – RSC vs Client decision framework](https://dev.to/whoffagents/react-server-components-vs-client-components-the-decision-framework-for-nextjs-14-2j67)

### Component design & splitting
- [Kent C. Dodds – When to break up a component](https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components)
- [Guidelines from the 1970s on splitting components (dev.to)](https://dev.to/imforja/guidelines-from-the-1970s-on-how-to-split-your-react-components-2jn5) · [original blog](https://joaoforja.com/blog/guideline-on-how-to-decompose-a-react-component)
- [David Tang – Techniques for decomposing React components](https://medium.com/dailyjs/techniques-for-decomposing-react-components-e8a1081ef5da)
- [Medium – Splitting Components in React](https://thiraphat-ps-dev.medium.com/splitting-components-in-react-a-path-to-cleaner-and-more-maintainable-code-f0828eca627c)
- [Medium – Six Pillars of Component Architecture](https://medium.com/@abbas-roholamin/splitting-a-ui-into-components-in-react-six-pillars-of-component-architecture-04538e542ce5)
- [frontarm – How should I separate components?](https://frontarm.com/james-k-nelson/how-should-i-separate-components/)

### Business logic / custom hooks
- [eMoosavi – Decoupling business logic with custom hooks](https://www.emoosavi.com/blog/decoupling-business-logic-from-ui-with-custom-react-hooks)
- [Felix Gerschau – Separation of concerns with React hooks](https://felixgerschau.com/react-hooks-separation-of-concerns/)
- [Medium – Separating business logic from UI in React 18](https://medium.com/design-bootcamp/separating-%EF%B8%8F-business-logic-from-ui-components-in-react-18-aa1775b3caba)
- [DhiWise – Keeping UI and logic separate](https://www.dhiwise.com/post/mastering-the-art-of-separating-ui-and-logic-in-react)

### State management & data fetching
- [Developer Way – React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025)
- [Makers' Den – State management trends 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Medium – Zustand + React Query](https://medium.com/@freeyeon96/zustand-react-query-new-state-management-7aad6090af56)
- [Medium – The Ultimate Guide to React Server State (fetch vs RQ vs SWR)](https://medium.com/@codeandbird/the-ultimate-guide-to-react-server-state-fetch-vs-react-query-vs-swr-b0633908194f)

### Naming conventions
- [sufle.io – Naming conventions in React](https://www.sufle.io/blog/naming-conventions-in-react)
- [Faraz – Opinionated folder structure & file naming](https://dev.to/farazamiruddin/an-opinionated-guide-to-react-folder-structure-file-naming-1l7i)
- [Hands on React – Code organization & conventions](https://handsonreact.com/docs/code-organization-conventions)
- [koistya – File/folder naming gist](https://gist.github.com/koistya/d7a507438c741ee6adb5)

### TypeScript
- [LogRocket – 10 React+TS patterns](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/)
- [typescript-cheatsheets/react](https://github.com/typescript-cheatsheets/react)
- [Steve Kinney – Component props with TypeScript](https://stevekinney.com/courses/react-typescript/component-props-complete-guide)
- [Telerik – React design patterns & best practices 2025](https://www.telerik.com/blogs/react-design-patterns-best-practices)

### Performance
- [Strapi – React.memo 2025 guide](https://strapi.io/blog/react-memo-optimize-functional-components-guide)
- [DebugBear – useMemo & useCallback](https://www.debugbear.com/blog/react-usememo-usecallback)
- [isitdev – React 19 Compiler vs useMemo/useCallback](https://isitdev.com/react-19-compiler-usememo-usecallback-dead-2025/)
- [Growin – React performance optimization 2025](https://www.growin.com/blog/react-performance-optimization-2025/)
- [Steve Kinney – useMemo/useCallback in React 19](https://stevekinney.com/courses/react-performance/usememo-usecallback-in-react-19)

### Testing
- [Makers' Den – Guide to RTL + Vitest](https://makersden.io/blog/guide-to-react-testing-library-vitest)
- [Incubyte – Vitest + RTL](https://blog.incubyte.co/blog/vitest-react-testing-library-guide/)
- [freeCodeCamp – Testing React apps with Vitest](https://www.freecodecamp.org/news/how-to-test-react-applications-with-vitest/)

### Barrel files
- [Next.js discussion #92926 – Barrel imports](https://github.com/vercel/next.js/discussions/92926)
- [Catch Metrics – Next.js barrel bundle size](https://www.catchmetrics.io/blog/nextjs-bundle-size-improvements-optimize-your-performance)
- [The Barrel Trap (dev.to)](https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872)
- [Why I won't use index files in 2025](https://medium.com/@aleksandr_ross/why-i-will-not-use-index-files-in-2025-b40db08dab00)
- [The Index.ts Dilemma](https://krishnavadlamudi44.medium.com/the-index-ts-dilemma-balancing-convenience-and-performance-in-typescript-projects-85e9dd4fc18f)
