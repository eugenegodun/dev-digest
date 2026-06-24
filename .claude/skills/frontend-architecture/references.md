# Sources & Rationale

Sources backing [SKILL.md](SKILL.md), grouped by topic. Researched June 2026; targets React 19 and
Next.js 15/16 (App Router). Full research notes: `docs/research/react-nextjs-best-practices.md`.

Where sources conflict, SKILL.md's "Project conventions chosen here" section records the chosen
default and the alternative.

## Folder structure / project organization
- [bulletproof-react — project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — **primary reference**; the shared/features/app layering + ESLint boundary config.
- [Robin Wieruch — React Folder Structure (2026)](https://www.robinwieruch.de/react-folder-structure/) — evolutionary model; the utils/lib/helpers distinction; promotion rule; "never nest > 2 levels".
- [Josh W. Comeau — Delightful React File Structure](https://www.joshwcomeau.com/react/file-structure/) — colocation, component folders.
- [Tania Rascia — Structure & organize a React app](https://www.taniarascia.com/react-architecture-directory-structure/) — colocation principle from React docs.
- [dev.to — Folder Structures in React Projects](https://dev.to/itswillt/folder-structures-in-react-projects-3dp8) — by-type vs by-feature; utils/lib/services definitions.
- [profy.dev — Folder structures & Screaming Architecture](https://profy.dev/article/react-folder-structure)
- [React Handbook — Project Standards](https://reacthandbook.dev/project-standards)
- [Netguru — Professional React project structure](https://www.netguru.com/blog/react-project-structure)

## Next.js App Router
- [Next.js docs — Project structure & organization](https://nextjs.org/docs/app/getting-started/project-structure) — **official**; route groups, private folders, colocation, src/, the 3 strategies.
- [Next.js docs — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — **official**.
- [Next.js docs — `use client` directive](https://nextjs.org/docs/app/api-reference/directives/use-client) — **official**.
- [Wisp CMS — Organizing your Next.js 15 project](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure) — feature modules, promotion, "page readable in 30s".
- [dev.to — Best practices for organizing Next.js 15 (2025)](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji) — no logic in `app/`, split the giant utils file.
- [dev.to — The Next.js 15 App Router structure that scales](https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha)

## Component design & splitting
- [Kent C. Dodds — When to break up a component](https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components) — the "can ≠ must" caveat.
- [Guidelines from the 1970s on splitting components](https://dev.to/imforja/guidelines-from-the-1970s-on-how-to-split-your-react-components-2jn5) ([original](https://joaoforja.com/blog/guideline-on-how-to-decompose-a-react-component)) — coupling/cohesion.
- [David Tang — Techniques for decomposing React components](https://medium.com/dailyjs/techniques-for-decomposing-react-components-e8a1081ef5da)
- [Medium — Splitting Components in React](https://thiraphat-ps-dev.medium.com/splitting-components-in-react-a-path-to-cleaner-and-more-maintainable-code-f0828eca627c)
- [frontarm — How should I separate components?](https://frontarm.com/james-k-nelson/how-should-i-separate-components/) — extraction signals.

## Business logic / custom hooks
- [eMoosavi — Decoupling business logic with custom hooks](https://www.emoosavi.com/blog/decoupling-business-logic-from-ui-with-custom-react-hooks)
- [Felix Gerschau — Separation of concerns with React hooks](https://felixgerschau.com/react-hooks-separation-of-concerns/)
- [Medium — Separating business logic from UI in React 18](https://medium.com/design-bootcamp/separating-%EF%B8%8F-business-logic-from-ui-components-in-react-18-aa1775b3caba)

## State management & data fetching
- [Developer Way — React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025) — separate server vs client state; the decision ladder.
- [Makers' Den — State management trends 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Medium — The Ultimate Guide to React Server State (fetch vs RQ vs SWR)](https://medium.com/@codeandbird/the-ultimate-guide-to-react-server-state-fetch-vs-react-query-vs-swr-b0633908194f)

## Naming conventions
- [sufle.io — Naming conventions in React](https://www.sufle.io/blog/naming-conventions-in-react)
- [Faraz — Opinionated folder structure & file naming](https://dev.to/farazamiruddin/an-opinionated-guide-to-react-folder-structure-file-naming-1l7i)
- [Hands on React — Code organization & conventions](https://handsonreact.com/docs/code-organization-conventions)

## Barrel files
- [Next.js discussion #92926 — Barrel imports](https://github.com/vercel/next.js/discussions/92926)
- [Catch Metrics — Next.js barrel bundle size & optimizePackageImports](https://www.catchmetrics.io/blog/nextjs-bundle-size-improvements-optimize-your-performance)
- [The Barrel Trap](https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872)
- [Why I won't use index files in 2025](https://medium.com/@aleksandr_ross/why-i-will-not-use-index-files-in-2025-b40db08dab00)

## Adjacent (covered by sibling skills, listed for completeness)
- TypeScript: [LogRocket — 10 React+TS patterns](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/) · [typescript-cheatsheets/react](https://github.com/typescript-cheatsheets/react)
- Performance: [React 19 Compiler vs useMemo/useCallback](https://isitdev.com/react-19-compiler-usememo-usecallback-dead-2025/)
- Testing: [Makers' Den — RTL + Vitest](https://makersden.io/blog/guide-to-react-testing-library-vitest)
