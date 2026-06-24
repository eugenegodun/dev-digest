# Placement Examples (Good vs Bad)

Concrete before/after for the rules in [SKILL.md](SKILL.md).

## 1. Business logic placement

❌ **Bad** — logic + fetching in the page/component body:

```tsx
// app/billing/page.tsx
export default async function BillingPage() {
  const res = await fetch(`${process.env.API_URL}/invoices`)
  const invoices = await res.json()
  const overdue = invoices.filter(i => i.dueDate < Date.now() && !i.paid)
  const total = overdue.reduce((s, i) => s + i.amountCents, 0) / 100
  return <div>{/* 150 lines of JSX + handlers */}</div>
}
```

✅ **Good** — page is thin; logic lives in the feature:

```tsx
// features/billing/api/get-invoices.ts        ← I/O (service)
export async function getInvoices() { /* uses lib/api-client */ }

// features/billing/utils/invoice.ts            ← pure, testable
export const selectOverdue = (invoices: Invoice[]) =>
  invoices.filter(i => i.dueDate < Date.now() && !i.paid)
export const sumCents = (invoices: Invoice[]) =>
  invoices.reduce((s, i) => s + i.amountCents, 0)

// app/billing/page.tsx                          ← routing only
import { getInvoices } from '@/features/billing/api/get-invoices'
import { InvoiceSummary } from '@/features/billing'
export default async function BillingPage() {
  const invoices = await getInvoices()
  return <InvoiceSummary invoices={invoices} />
}
```

## 2. util vs lib vs service

```ts
// utils/format-currency.ts   ✅ generic, portable, pure
export const formatCurrency = (cents: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100)

// lib/api-client.ts          ✅ tech-coupled, pre-configured instance
import axios from 'axios'
export const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL })

// features/billing/api/create-invoice.ts   ✅ business logic + I/O
import { apiClient } from '@/lib/api-client'
export const createInvoice = (dto: CreateInvoiceDto) =>
  apiClient.post('/invoices', dto).then(r => r.data)
```

❌ **Bad** — everything dumped in one file:

```ts
// utils.ts  (2,000 lines) — formatting, the axios instance, AND createInvoice business logic
```

## 3. "helpers" — don't make it a thing

❌ `src/helpers/billingHelpers.ts` (vague top-level bucket)

✅ Decide by nature:
- generic? → `utils/` · tech-coupled? → `lib/` · business/I/O? → `features/billing/api/` ·
  tiny feature-local glue? → `features/billing/utils/`

## 4. Splitting a component (file-first → folder)

❌ **Bad** — premature folder + barrel for a 15-line component:

```
Avatar/
├── Avatar.tsx
└── index.ts        // re-export just to write `from './Avatar'`
```

✅ **Good** — start flat, promote when a 2nd sibling file appears:

```
// stage 1
Avatar.tsx

// stage 2 (added tests + styles → now it earns a folder)
Avatar/
├── Avatar.tsx
├── Avatar.test.tsx
└── Avatar.module.css
```

## 5. Composition over prop drilling

❌ **Bad** — drilling props through layers:

```tsx
<Page user={user} theme={theme} />
  <Layout user={user} theme={theme} />
    <Header user={user} theme={theme} />
```

✅ **Good** — compose with `children`, read shared values from a hook/Context at the leaf:

```tsx
<Page>
  <Layout>
    <Header />   {/* useCurrentUser() / useTheme() where actually needed */}
  </Layout>
</Page>
```

## 6. Cross-feature import (boundary violation)

❌ **Bad** — `billing` reaches into `auth` internals:

```ts
// features/billing/components/InvoiceTable.tsx
import { hashToken } from '@/features/auth/utils/token'   // ⛔ cross-feature
```

✅ **Good** — shared concern moves up to the shared layer:

```ts
// lib/token.ts        (now shared, imported by any feature)
import { hashToken } from '@/lib/token'
```

## 7. Barrel files

✅ **Allowed** — one public-API barrel per feature:

```ts
// features/billing/index.ts
export { InvoiceTable } from './components/InvoiceTable'
export { useInvoices } from './api/useInvoices'
// consumers: import { InvoiceTable } from '@/features/billing'
```

❌ **Bad** — global re-export barrel that kills tree-shaking:

```ts
// components/index.ts
export * from './ui/Button'
export * from './ui/Modal'
export * from './everything-else'   // one import pulls the whole graph
```

## 8. Constants placement

```ts
// Button.constants.ts          ← used only by Button
export const BUTTON_VARIANTS = ['primary', 'secondary'] as const

// features/billing/constants.ts ← feature-wide
export const MAX_INVOICE_ITEMS = 100

// config/app.ts                 ← app-wide
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024 } as const
```
