/**
 * Onion Architecture enforcement for dev-digest backend.
 *
 * Encodes the inward-only dependency rule as machine-checkable constraints.
 * dependency-cruiser is already a dev dependency of `server/`.
 *
 * Run from the server/ directory (tsconfig resolves its `include` relative to cwd):
 *   cd server && npx depcruise \
 *     --config ../.claude/skills/onion-architecture/dependency-cruiser.cjs \
 *     --ts-config tsconfig.json src ../reviewer-core/src
 *
 * To make it permanent, add to server/package.json:
 *   "scripts": { "lint:arch": "depcruise --config ../.claude/skills/onion-architecture/dependency-cruiser.cjs --ts-config tsconfig.json src ../reviewer-core/src" }
 * and run `pnpm lint:arch` in CI.
 *
 * `from`/`to.path` are regexes matched against module paths relative to the cwd
 * the command runs in (repo root in the example above). Adjust the `server/`
 * and `reviewer-core/` prefixes if you run it from a different directory.
 */

// Packages that may only be imported from the infrastructure ring (adapters / db / repositories).
const ORM = 'node_modules/(drizzle-orm|postgres)';
const SDKS = 'node_modules/(openai|@anthropic-ai|octokit|simple-git)';
// DB / GitHub / git clients are forbidden inside the domain core. The LLM SDK is
// NOT in this list: reviewer-core's one sanctioned external is the LLM (it ships
// an OpenRouter/OpenAI-compatible provider in reviewer-core/src/llm/).
const CORE_FORBIDDEN = 'node_modules/(drizzle-orm|postgres|octokit|simple-git|fastify)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'reviewer-core-stays-pure',
      severity: 'error',
      comment:
        'reviewer-core is the domain core — no DB, GitHub, git, HTTP, or server infrastructure. ' +
        'Its one sanctioned external is the LLM (provider in reviewer-core/src/llm/). ' +
        'Resolve everything else in a server repository and pass it in as plain input.',
      from: { path: 'reviewer-core/src' },
      to: { path: `(${CORE_FORBIDDEN}|server/src/(db|adapters))` },
    },
    {
      name: 'routes-no-db',
      severity: 'error',
      comment:
        'A route handler (presentation) must not touch the database. Move the query to a ' +
        'repository.ts and have the route call a service.',
      from: { path: '/modules/[^/]+/routes\\.ts$' },
      to: { path: `(${ORM}|/src/db/)` },
    },
    {
      name: 'routes-no-sdk',
      severity: 'error',
      comment:
        'A route handler must not call an external SDK directly. Go through an adapter resolved from container.',
      from: { path: '/modules/[^/]+/routes\\.ts$' },
      to: { path: SDKS },
    },
    {
      name: 'service-no-orm',
      severity: 'error',
      comment:
        'A service (application layer) must not build DB queries. Drizzle belongs in a repository.ts. ' +
        'Importing row TYPES from db/rows is fine; importing the query builder is not.',
      from: { path: '/modules/[^/]+/service\\.ts$' },
      to: { path: ORM },
    },
    {
      name: 'service-no-sdk',
      severity: 'error',
      comment:
        'A service must not import an external SDK directly — depend on the adapter interface ' +
        'from vendor/shared/adapters.ts and resolve it via container.',
      from: { path: '/modules/[^/]+/service\\.ts$' },
      to: { path: SDKS },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    // tsConfig is supplied via --ts-config on the CLI so this file stays path-agnostic.
  },
};
