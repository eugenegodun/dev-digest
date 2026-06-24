/* env.ts — centralized environment access for the web app. Read env vars HERE,
   not ad hoc across the codebase. `NEXT_PUBLIC_*` vars are inlined at build time
   by Next.js, so the default below applies when the var is unset. */

export const env = {
  /** Base URL of the F1 Fastify API. */
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001",
} as const;
