# Dairy Diary — CLAUDE.md

Milk ledger & billing app for dairy farms/milk shops in Pakistan ("SAWAA" brand). Tracks daily
milk deliveries (buy from sellers / sell to buyers), calculates monthly dues, records payments,
and generates PDF bills/receipts. Currently a **client-only PWA** — all data lives in the
browser's `localStorage`; there is no backend/API wired up yet.

## Commands

```bash
npm install     # install dependencies (bun.lock also present, so `bun install` works too)
npm run dev      # start Vite dev server on http://0.0.0.0:3000
npm run build    # production build (vite build) -> dist/
npm run preview  # preview the production build
npm run lint      # type-check only (tsc --noEmit); there is no separate eslint config
npm run clean    # rm -rf dist server.js
```

There are no automated tests in the repo.

## Tech Stack

- **React 19** + **TypeScript** (strict-ish; `tsc --noEmit` is the only "lint")
- **Vite 8** (`vite.config.ts`) with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Tailwind CSS v4** (imported via `@import "tailwindcss"` in `src/index.css`, plus hand-rolled
  utility classes like `.glass-card` / `.glass-tile` for the app's light "glass" theme)
- **lucide-react** for icons, **motion** (Framer Motion successor) for animation
- **jspdf** + **qrcode** — used in `src/utils/pdfGenerator.ts` to generate PDF bills/receipts
  with embedded payment QR codes
- Path alias `@/*` → project root (configured in both `tsconfig.json` and `vite.config.ts`)
- This project was scaffolded from a **Google AI Studio** template: `package.json` still lists
  `@google/genai`, `express`, and `dotenv`, and `.env.example` / `metadata.json` reference a
  Gemini API key and `APP_URL`. **None of this is currently used anywhere in `src/`** — there is
  no AI/Gemini call and no Express server in the codebase. Treat these as inherited/unused
  scaffolding unless a task specifically asks to wire up AI Studio integration.
- PWA: `public/manifest.json` + `public/sw.js`, registered in `src/main.tsx`.

## Architecture

Single-page app, no router — navigation is done via React state (`activeNavTab` in `App.tsx`),
not URL routes (one exception: `?tab=...` query param sets the initial tab on load).

```
index.html            Vite entry, loads src/main.tsx
src/main.tsx           React root + PWA service-worker registration
src/App.tsx             ~1000-line root component: ALL app state lives here (contacts, ledger
                        entries, expenses, reminders, settings, payment records, premium flag),
                        plus every mutation handler (add/edit/delete entry, settle payment, add
                        user, etc.). Renders MobileFrame + TopAppBar + BottomNavBar and swaps the
                        active view/modal based on activeNavTab and various show*Modal booleans.
src/types/dairy.ts      All shared TypeScript types/interfaces (Contact, LedgerEntry,
                        PaymentRecord, BusinessSettings, ExpenseItem, etc.) — the data model.
src/data/mockDairyData.ts  Seed/demo data (INITIAL_CONTACTS, INITIAL_LEDGER_ENTRIES, etc.) used
                        the first time the app runs (before anything is in localStorage) and as
                        the fallback if storage is empty/corrupt.
src/utils/
  calculations.ts       Financial engine — see "Key business logic" below.
  storage.ts             localStorage persistence layer (load/save per entity) + full
                        export/import for backup & restore.
  formatters.ts          Date/currency/time formatting (PKR, liters, relative "Today, 3 min ago"
                        style timestamps), WhatsApp message text generation.
  pdfGenerator.ts        Builds PDF bills/receipts with jsPDF + embeds payment QR codes.
  paymentAccounts.ts     Resolves which payment accounts (EasyPaisa/JazzCash/Bank) should be
                        shown on customer-facing documents.
  regionalPaymentConfig.ts  Large config of region/country payment method presets (for the
                        multi-currency/region settings flow).
  distanceCalculator.ts  GPS/path distance + fuel-cost estimation for the delivery route Tracker
                        feature.
src/components/         ~35 presentational/feature components (one file per screen or modal:
                        AddEntryScreen, EditEntryScreen, ContactDetailModal, ReportsView,
                        ExpensesView, SettingsView, TrackerView, BackupModal, MonthlyBillingModal,
                        etc.). These receive data/handlers as props from App.tsx — there's no
                        separate global state manager (no Redux/Zustand/Context store).
src/schema/schema.sql   A **reference/future** PostgreSQL schema (users, contacts, ledger_entries,
                        transactions, expenses, triggers) for a planned real backend. It is NOT
                        currently connected to anything — the live app only uses localStorage.
                        Treat it as a design doc for a future migration, not current behavior.
public/                 PWA assets: manifest.json, service worker (sw.js), icons/favicons.
proposed-logo/          Standalone logo exploration assets (SVG/PNG variants) — not imported by
                        the app; purely design reference material.
```

## Key business logic & conventions

- **`getCustomerMonthDue()` in [src/utils/calculations.ts](src/utils/calculations.ts) is the
  single source of truth for one customer's monthly financials.** Rule: `due = max(0, amount -
  received)`, where `received` = sum of `receivedAmount` on that month's ledger entries +
  matching `PaymentRecord`s (de-duplicated by signature). `previousDue` is the same calculation
  summed over all **prior** months. Any screen showing a customer's due/outstanding balance
  should go through this function (or `getTabSummary()`), not recompute it ad hoc.
- **`getTabSummary()`** aggregates `getCustomerMonthDue()` across a list of contacts. Critical
  rule called out in the code: **total due is the SUM of each customer's own due, never**
  `globalAmount - globalReceived`.
- **`Contact.currentMonthDue` / `Contact.totalLifetimeDue` are legacy cached fields** — the code
  comments explicitly mark them `⚠️ LEGACY: Deprecated for display. Do NOT read in JSX.` New UI
  should derive due/outstanding figures from `calculations.ts`, not these stored fields (they're
  kept in sync by the mutation handlers in `App.tsx` for backward compatibility / list sorting).
- **Duplicate-entry guard**: a ledger entry is considered a duplicate if the same
  `contactId` + `date` + `shift` already exists (see `handleSaveEntry` /
  `handleSaveBulkEntries` in `App.tsx`). Duplicates are rejected with a toast, not silently
  merged.
- **Persistence**: every piece of app state is mirrored to `localStorage` under versioned keys
  (`dairy_diary_contacts_v2`, etc. — see `KEYS` in `storage.ts`). `storage.ts` auto-purges `_v1`
  legacy keys on load. Full backup/restore goes through `exportFullDatabase()` /
  `restoreFullDatabase()` (used by `BackupModal`).
- **Currency/units**: all money is PKR, formatted via `formatPKR` / `formatPKRWithSpace` in
  `formatters.ts` (e.g. `Rs12,345`); liters formatted via `formatLiters`. Dates are
  `YYYY-MM-DD` strings; month keys are `YYYY-MM` strings (helpers: `getDeviceTodayDate`,
  `getDeviceCurrentMonthKey`, `shiftMonthKey`, `shiftDateString`).
- **Roles**: a `Contact.role` is `'seller'` (dairy farmer the business buys milk from) or
  `'buyer'` (customer the business sells milk to). The "Buy Milk" / "Sell Milk" segmented tabs in
  `App.tsx` filter on this.
- Component code is dense with numbered inline comments referencing informal spec "Requirements"
  and "Warnings" (e.g. `WARNING 5`, `WARNING 7`) — these mark specific business rules that were
  deliberately implemented a certain way (duplicate checks, relative-time formatting rules, GPS
  point filtering, currency-switch confirmation, etc.). Read the surrounding comment before
  changing that logic; it usually encodes a rule from the original product spec, not an
  accident.
- Styling: Tailwind utility classes plus a small set of custom "glass" theme classes defined in
  `src/index.css` (`.glass-card`, `.glass-tile`, `.glass-pill`, `.bg-glass-gradient`). Primary
  brand color is a dark forest green (`#1E5631` / `#006B52`).

## Notes for future sessions

- No test suite exists — verify changes by running `npm run dev` and exercising the UI, plus
  `npm run lint` (type-check) before considering a change done.
- Treat `@google/genai`, `express`, `dotenv`, and `src/schema/schema.sql` as **not currently
  wired up** — don't assume AI calls or a SQL backend exist unless you're the one adding them.
- All financial logic should flow through `src/utils/calculations.ts`; avoid duplicating the
  due/outstanding math in components.

---

## STANDING RULES — NEVER VIOLATE

1. LOGO IS FROZEN. Never change, replace, move, rename, or
   regenerate the Dairy Diary logo or wordmark. The only unlock
   phrase is "Replace the logo now."

2. UI IS APPROVED. Never change colors, layout, fonts, or icon
   styles unless I explicitly ask.

3. SINGLE SOURCE OF TRUTH. All math must use getCustomerMonthDue
   from src/utils/calculations.ts. Never duplicate formulas.

4. BUGS 1–5 FIXES ARE LOCKED. The five math fixes are done:
   - Hardcoded 7560 removed
   - Outstanding uses current month only
   - Payments scoped by billingMonth
   - Reports uses per-customer due sum
   - Stale static fields (currentMonthDue / totalLifetimeDue) are
     not read for display
   Never revert these.

5. DATA IS SACRED. Never delete or modify customer records,
   entries, payments, expenses, or settings without explicit
   instruction. Never clear IndexedDB or localStorage.

6. NO PACKAGE INSTALLS without asking first.

7. NO SILENT CHANGES. Always show diffs before applying.

8. ALWAYS CONFIRM BEFORE:
   - Deleting any file
   - Renaming any file
   - Modifying more than 3 files in one task
   - Adding any new dependency

9. AUTO MODE IS FOR READS ONLY. Use auto mode for reads, searches,
   and exploration. For any WRITE (edit, create, delete), show me
   the diff and wait for my approval.

10. After each completed task, overwrite dairy-diary-source.zip in
    the project root.
