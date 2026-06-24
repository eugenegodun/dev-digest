# Onion Architecture — references

Sources for the principles this skill enforces. Onion (Palermo, 2008),
Hexagonal/Ports-and-Adapters (Cockburn, 2005), and Clean (Martin, 2012) are three
framings of one idea: business logic at the center, infrastructure at the edge,
dependencies pointing inward.

## Canonical

- **The Onion Architecture: Part 1** — Jeffrey Palermo (coined the term) —
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
  Concentric layers, the inward-only dependency rule, "the database is external, not the center."
- **The Onion Architecture: Part 2** — Jeffrey Palermo —
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
  Repository interfaces in the core, implementations at the edge.
- **Onion Architecture: Part 4 (After Four Years)** — Jeffrey Palermo —
  http://jeffreypalermo.com/blog/onion-architecture-part-4-after-four-years/
  Retrospective restating the tenets after real-world adoption.
- **The Clean Architecture** — Robert C. Martin —
  https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
  The Dependency Rule and the four circles; never pass entities/DB rows across boundaries.
- **Hexagonal Architecture (Ports & Adapters)** — Alistair Cockburn —
  https://alistair.cockburn.us/hexagonal-architecture
  The parent idea Onion/Clean refine. (Site's TLS cert is currently expired — a
  browser may warn; stable mirror: https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))

## Comparisons

- **Onion vs Clean vs Hexagonal Architecture** — Eric Damtoft —
  https://medium.com/@edamtoft/onion-vs-clean-vs-hexagonal-architecture-9ad94a27da91
  All three are the same DIP-based idea with different vocabulary.
- **Demystifying software architecture patterns** — Thoughtworks —
  https://www.thoughtworks.com/en-us/insights/blog/architecture/demystify-software-architecture-patterns
  Hexagonal (2005) → Onion (2008) → Clean (2012) on a timeline with shared principles.

## Practical TypeScript / Node.js

- **Clean Architecture with TypeScript: DDD, Onion** — André Bazaglia —
  https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/
  Concrete TS layout (`domain`/`app`/`api`/`infra`), repository interfaces in domain,
  implementations in infra, mappers as a translation boundary.
- **Clean Node.js Architecture** — Khalil Stemmler —
  https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/
  Ports as interfaces with swappable adapters; Express/ORM kept at the edge; warns against over-engineering.
- **Better Software Design with Application Layer Use Cases** — Khalil Stemmler —
  https://khalilstemmler.com/articles/enterprise-typescript-nodejs/application-layer-use-cases/
  The application/use-case layer in TS/Node and how it orchestrates the domain.
- **ddd-forum** (reference repo) — stemmlerjs —
  https://github.com/stemmlerjs/ddd-forum
  Full TypeScript app applying Clean Architecture + DDD layering end-to-end.
- **onion-architecture-boilerplate** — Melzar —
  https://github.com/Melzar/onion-architecture-boilerplate
  Node/Express + TypeScript Onion boilerplate showing the layer split in a runnable project.

## Pitfalls

- **Anemic Domain Model** — Martin Fowler —
  https://martinfowler.com/bliki/AnemicDomainModel.html
  The anti-pattern: domain objects reduced to getter/setter bags with behavior leaked into services.

## How this maps to dev-digest

- Domain core = `reviewer-core/src` (pure; only an injected `LLMProvider`).
- Ports/interfaces = `*/src/vendor/shared/adapters.ts`.
- Adapters/infrastructure = `server/src/adapters/*`, `server/src/db/*`, `modules/*/repository.ts`.
- Composition root / DI = `server/src/platform/container.ts`.
- Boundary validation = Zod via `fastify-type-provider-zod` in `modules/*/routes.ts`.
