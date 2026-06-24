# Onion Architecture — placement examples

Each example is a real task. ❌ is the layering leak agents reach for under
"keep it lean" pressure; ✅ is the same code in the right rings.

---

## 1. Read endpoint: findings grouped by severity

`GET /workspace/review-stats` — count findings by severity across a workspace.

### ❌ Leak: Drizzle query in the route (CRITICAL)

```ts
// modules/workspace/routes.ts
import { eq, sql } from 'drizzle-orm';        // ← SDK in presentation layer
import * as t from '../../db/schema.js';      // ← db schema in presentation layer

app.get('/workspace/review-stats', async (req) => {
  const { workspaceId } = await getContext(container, req);
  const rows = await container.db                // ← query in a route handler
    .select({ severity: t.findings.severity, count: sql<number>`count(*)::int` })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
    .where(eq(t.reviews.workspaceId, workspaceId))
    .groupBy(t.findings.severity);
  // ...rollup inline...
});
```

Rationalized as *"a quick read endpoint can call the repo directly."* It can't —
it imports `drizzle-orm` and `db/schema` straight into the presentation ring.

### ✅ Query in repository, route delegates through a service

```ts
// modules/reviews/repository/review.repo.ts   (INFRASTRUCTURE — the only place Drizzle lives)
export async function findingSeverityCounts(db: Db, workspaceId: string) {
  const rows = await db
    .select({ severity: t.findings.severity, count: sql<number>`count(*)::int` })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
    .where(eq(t.reviews.workspaceId, workspaceId))
    .groupBy(t.findings.severity);
  return rows;
}
```

```ts
// modules/reviews/service.ts                   (APPLICATION — orchestrates, rolls up)
async severityStats(workspaceId: string) {
  const rows = await reviewRepo.findingSeverityCounts(this.container.db, workspaceId);
  return rollupSeverities(rows); // reuse the shared helper, don't inline the rollup
}
```

```ts
// modules/workspace/routes.ts                  (PRESENTATION — validate + delegate)
app.get('/workspace/review-stats', async (req) => {
  const { workspaceId } = await getContext(container, req);
  return reviewsService(container).severityStats(workspaceId);
});
```

The route imports no `drizzle-orm`, no `db/schema`. Same line count, right rings.

---

## 2. Feature endpoint: summarize a PR with an LLM

`POST /pulls/:id/summarize` — load the diff, call an LLM, return a summary.

### ❌ Leak: query + SDK call in the route (CRITICAL)

```ts
// modules/pulls/routes.ts
app.post('/pulls/:id/summarize', { schema: { params: IdParams } }, async (req) => {
  const files = await container.db                    // ← query in route
    .select({ path: t.prFiles.path, patch: t.prFiles.patch })
    .from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
  const llm = await container.llm('anthropic');        // provider hardcoded in route
  const result = await llm.complete({ /* prompt assembled inline */ });
  return { summary: result.text.trim() };
});
```

Rationalized as *"the thin feature adds one handler and zero new layers."*

### ✅ Diff via repository, LLM via adapter, route delegates

```ts
// modules/pulls/repository.ts        (INFRASTRUCTURE)
export async function prDiffFiles(db: Db, prId: string) {
  return db.select({ path: t.prFiles.path, patch: t.prFiles.patch })
    .from(t.prFiles).where(eq(t.prFiles.prId, prId));
}
```

```ts
// modules/pulls/service.ts           (APPLICATION — orchestrates repo + adapter)
async summarize(workspaceId: string, prId: string) {
  const { pr } = await this.resolvePr(workspaceId, prId);
  const files = await pullsRepo.prDiffFiles(this.container.db, prId);
  const diff = buildDiff(files);
  if (!diff) throw new AppError('no_diff', 'No diff imported for this PR.', 400);
  const llm = await this.container.llm();           // adapter, provider resolved centrally
  const model = routeModel('summary');
  const { text } = await llm.complete({ model, messages: summarizePrompt(pr, diff) });
  return { summary: text.trim(), model };
}
```

```ts
// modules/pulls/routes.ts            (PRESENTATION)
app.post('/pulls/:id/summarize', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  return pullsService(container).summarize(workspaceId, req.params.id);
});
```

---

## 3. reviewer-core needs author info — keep the core pure (HIGH)

Task: attach each finding's GitHub author so the engine can use it when scoring.

### ❌ Leak: DB join inside reviewer-core

```ts
// reviewer-core/src/review/run.ts
import { db } from '../../../server/src/db/client'; // ← infrastructure inside the domain core
const author = await db.select(/* join findings → reviews → pull_requests */);
```

### ✅ Resolve in a server repository, pass plain data inward

```ts
// server: modules/reviews/repository/review.repo.ts   (INFRASTRUCTURE does the join)
export async function authorsForFindings(db: Db, ids: string[]) {
  return db.select({ findingId: t.findings.id, authorHandle: t.pullRequests.author })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
    .innerJoin(t.pullRequests, eq(t.reviews.pullRequestId, t.pullRequests.id))
    .where(inArray(t.findings.id, ids));
}
```

```ts
// reviewer-core/src/review/run.ts   (DOMAIN CORE receives data, imports nothing outward)
export interface FindingWithAuthor { findingId: string; authorHandle: string }
// scoring uses author info that was passed in — no DB, no network.
```

The dependency points inward: the server (outer) resolves and hands data to the
core (inner); the core never reaches out.
