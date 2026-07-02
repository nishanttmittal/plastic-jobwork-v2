# APP MAP — Plastic Job Work v2 (architecture & where things live)

Read this first, then `app/src/**`. Everything is under `app/src/`.

## The business, in one paragraph
UNICO issues plastic **compound (kg)** + **nuts (inserts)** to an outside **moulder**. He moulds pieces
(1 nut per piece) on his machine and returns finished pieces + leftover material (runner/regrind/loose
nuts). The app records every movement, **reconciles material** (compound issued vs plastic in good
pieces + returned scrap + balance), computes **cost per piece**, and runs the **moulder payment ledger
("Hisab")**. Material is tracked by **weight**; pieces are derived; **costing/pay use pieces**.

## Framework layer — `core/` (reusable across all UNICO apps; extend, don't fork)
- `core/db/repository.js` — generic CRUD over a storage adapter (`createCollection`/`createSingleton`,
  `makeId`, a `normalize` hook so NEW fields are added to old records safely = additive migrations).
- `core/db/storage.js` — swappable backend; `firebase.js` / `firebaseConfig.js` — Firebase init +
  `PHASE1_LOCAL_ONLY` flag (false here = live Firestore). `migrations.js`.
- `core/hooks/useCollection.js` — live collection hook. `core/schema/field.js` — field/normalize helper.
- `core/ui/` — Button, Card, PasswordGate, Toast, inputs (NumberInput etc.), `instrument.jsx`
  (InstrumentCard/Readout/StatusPip — the dark "Machined Instrument" UI kit).
- `core/utils/format.js` — dates + `fmtNum` (whole ₹/counts), **`fmtCountKg(count,kg)`** (nuts — explicit
  weighed kg), **`fmtPcsKg(pieces,gPerPiece)`** (finished pieces — fixed g/piece). Owner rule: show
  "pieces (kg)" everywhere material moves.

## Shell — `src/app/`
`AppShell.jsx` (bottom-nav, filters pages by role), `AuthGate.jsx` (Google login + email allowlist),
`NavBar`, `ModuleHome`. `App.jsx` mounts the module from `modules/registry.js`.

## The module — `src/modules/plastic/`
- `config.js` — constants: OWNER_EMAILS, ADMIN_PASSWORD, REJECT_REASONS, MACHINE_ECONOMICS/CAPACITY,
  SEED_* masters (compounds, masterbatch, inserts/nuts, molders, products with BOM).
- `schema.js` — issue / production / return / payment / purchase field schemas (additive).
- `PlasticContext.jsx` + `FirestoreProvider.jsx` — data layer; per-doc collections + masters singleton.
- `manifest.jsx` — registers pages + nav + roles.
- **`logic/`** (pure, unit-tested — the money math lives here, NOT in pages):
  - `costing.js` — material cost/piece (compound g/piece × rate + nut ₹/piece), `jobWorkTotal`.
  - `reconcile.js` — `molderBalance` (compound + nut reconciliation, nut kg fields), piece-weight helpers.
  - `lot.js` — `lotReconciliation` (sent vs received vs returned per lot, 2 cost rates, nut kg fields,
    finalize lock check), lot numbering.
  - `hisab.js` — moulder payment ledger + PDF. `lotPdf.js` — per-lot reconciliation PDF.
  - `stock.js` — stock DERIVED from purchases − issues + returns (never stored). `machineLoad.js` —
    make-vs-buy / buy-the-machine signal.
  - `__tests__/numbers.test.js` — 24 Vitest pins on real KUPPA-01 figures + weight/legacy/scenario cases.
- **`pages/`**: Home (dashboard), Record (hub → IssueCompound / NewProduction / ReturnMaterial),
  Jobs (→ Moulders + LotReport), Costing, Settings (→ Stock, Masters, MachineLoad, Dashboard(QC),
  Entries, Admin, MaterialLog). More = secondary menu.

## Roles
- **Owner** (bootstrap `nspenterprises24@gmail.com`) = everything incl. money/costing/masters/admin.
- **Manager** = material in/out + Material log only; money/costing hidden.
- Added via Admin → Users & Access (doc id = email; rules resolve role).

## Data — Firestore `apps/plasticjobwork/*`
Collections: `issues`, `production`, `returns`, `purchases`, `payments`, `logs`, `users` + `meta`
singletons (masters, lotlocks). Stock is derived. Rules (see `firestore.rules`): issues/production/
returns/logs/meta = any allowlisted signed-in user; **purchases + payments = owner-only**; users read
= signed-in, write = owner. (Just fixed: returns/purchases previously had NO rule → client writes were
silently denied.)

## Key rules baked in
- Cost/piece = compound(g/piece×₹/kg) + nut ₹1.50/piece + jobwork(shiftCost ÷ pieces). **Nut cost is
  per PIECE, not by issued count.** Moulder pay = shift-time based (₹4,500/12h), GST toggle.
- Nuts issued/returned BY WEIGHT (kg); count derived. **Nut weight can differ lot to lot** → optional
  per-entry g/nut (prefilled from 8.3 g master); displays use the actual weighed kg.
- Lot **Finalize/lock** freezes pay (client-side check; server-side enforcement = deferred Security Phase).
- Reconciliation flags if more plastic came out than went in.

## Deploy / ops
`npm run build` (Vite; only gate — no test runner in CI, but Vitest exists locally), `npm run deploy`
→ gh-pages (`--dotfiles --nojekyll` load-bearing). Base `/plastic-jobwork-v2/`. PWA auto-update.
Shared Firestore free tier (50k reads/day across ALL UNICO apps) = the main scaling constraint.

## Known, deliberately-deferred (don't re-flag as new)
- Server-side enforcement of lot locks + per-field validation (roles are enforced at collection level,
  not field level) = the planned "Security Phase" before external contractors get access.
- Real per-user auth beyond Google allowlist; automatic scheduled backups; rate-limiting.
