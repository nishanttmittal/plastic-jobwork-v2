# STATUS / MILESTONES — Plastic Job Work v2 (for reviewers)

Read this so you don't re-flag things already fixed. HEAD reflects the fixes below.

## What this app is
UNICO issues plastic **compound (kg)** + **nuts** to an outside **moulder**; he moulds pieces (1 nut
each) and returns finished pieces + leftover material. The app records movements, **reconciles material**,
computes **cost/piece**, and runs the **moulder payment ledger (Hisab)**. Material tracked by weight;
pieces derived; **costing/pay use pieces**. Production app on live shared Firestore (free tier).

## Recent work (all DONE + deployed live)
- **Nuts by weight, per-lot nut weight** (nut size differs lot to lot): Issue/Return take an optional
  "nut weight this lot (g)" (prefilled from the 8.3 g master); count derived; actual weighed kg stored
  per entry and used in all displays ("pieces (kg)" everywhere). reconcile/lot expose nut kg fields.
- **Firestore rules bug fixed**: `returns` + `purchases` had NO rule → client writes were silently
  denied. Now: returns = staff, purchases = owner-only. payments already owner-only.
- **Data-safety hardening (from prior full-app reviews):**
  - Admin restore/reset: auto-download a safety backup of current data FIRST, show record counts,
    require a typed confirmation (RESTORE / CLEAR). Admin is also behind a password gate.
  - Entries: nuts edited BY WEIGHT (kg); the count is recomputed from the entry's own g/nut on save
    (pure helper `nutCountFromKg`) so count never drifts from kg.
  - FirestoreProvider swallows the owner-only permission-denied on `purchases` for manager sessions
    (mirrors the payments handler).
  - Admin: adding an existing user upserts (no duplicate).
- **Tests:** 27 Vitest pins on real KUPPA-01 numbers + weight/legacy/fractional/rounding/multi-issue/
  full-scenario/edit-consistency. Build + lint clean (0 errors).

## Known, DELIBERATELY deferred (please do NOT re-flag as new defects)
- **Finalized-lot finalize/reopen is not atomic** (multi-write). Low probability, and recoverable via
  Reopen; refactoring it touches the working pay-freeze path + both data providers → deferred on purpose.
- **Server-side enforcement of lot locks + per-field validation** = the planned "Security Phase" before
  external contractors get access. Roles ARE enforced at the collection level (owner vs manager); field
  and lock enforcement are client-side today.
- **Firestore read scaling** (actively being addressed):
  - Persistent local cache IS enabled (`persistentLocalCache` + multi-tab) → repeat opens serve from
    cache and sync only deltas; it is NOT "read all history on every open".
  - **`logs` subscription now capped** at the newest 500 (`orderBy ts desc, limit 500`) — it grows
    fastest and is only used for a recent-activity view.
  - **Transaction collections (`production`/`issues`/`returns`) are deliberately NOT date-windowed**,
    because all-time reconciliation, stock (Σ purchases−issues+returns), and moulder hisab need full
    history — naive windowing would corrupt those totals. The correct scaling fix is **derived monthly
    summary docs** (see below) so Home/reports read a summary instead of scanning history; that is a
    planned architecture step, not done yet.
- **Costing rate source**: costing uses product master rates; stock tracks purchase lot prices. A future
  UI could let the owner choose master/latest/average.

## What I'd value in THIS review
Fresh eyes on: any DATA-LOSS or MONEY-CALC risk not already covered above; correctness of the
reconciliation/costing/hisab math; anything that breaks a manager (non-owner) session; and honest
"this is fine, don't touch it" calls so I don't over-engineer. Prior reviews scored ~4.4–4.95/5,
"ship internally: yes".
