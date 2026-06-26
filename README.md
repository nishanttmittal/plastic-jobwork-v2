# Plastic Job Work (UNICO)

Tracks plastic injection-moulding job work: compound/nuts issued to molders,
production returned, **cost per piece**, **material reconciliation** (with
wastage/burnt/regrind), and **per-molder hisab** (dues, advances, balance, PDF).

Built on the shared UNICO factory-app framework (`src/core` + `src/app`), as a
single module (`src/modules/plastic`).

## Run locally (WSL)
```bash
cd /home/nishel/plastic-jobwork
npm install      # first time only
npm run dev      # opens http://localhost:5173/plastic-jobwork/
```

## Deploy online (GitHub Pages → WhatsApp link)
```bash
npm run deploy   # builds + pushes dist to gh-pages
```
Live URL: `https://<github-user>.github.io/plastic-jobwork/`

## Phase 1 = LOCAL-ONLY (by design)
Runs on the device's local storage — no login, works offline, deploys online.
Data is per-device; use **Admin → Backup** for safety. This deliberately avoids
touching the shared `unico-operations` Firestore rules.

To turn on cloud multi-device sync later, see `CLOUD-ENABLE.md`.

## Screens
- **Dashboard** — cost/piece, molder balances + 🚩 flags, buy-the-machine indicator
- **New Production** — record a shift's output (multi-product), live cost preview
- **Issue Material** — give compound / masterbatch / nuts to a molder
- **Molder Hisab** — dues, advances, payments, balance + PDF
- **Masters & Rates** — compounds, masterbatch, nuts, molders, products (BOM)
- **Admin** — backup/restore, activity log, void, reset (password gated)

## Known numbers (seeded, editable in Masters)
PP ₹80/kg · Nut ₹1.50 · Molder ₹5,000/12-hr shift (180-ton) · Cap = PP 38.9 g +
1 nut, 4 cavities → ~₹6.2/piece at ~3,200 pcs/shift.
