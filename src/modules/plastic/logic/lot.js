/**
 * Lot reconciliation — ties ONE raw-material lot sent to a molder to everything
 * received back against it, and computes the true cost per piece two ways.
 *
 * A "lot" is just a tag (LOT-01, LOT-02…) carried on issues, production and
 * returns. Issuing material opens/extends a lot; production and returns are
 * tagged to the lot they belong to. Entries with no lotNo are ignored here
 * (they still show in the normal per-molder views) — fully additive.
 *
 * TWO PIECE-RATES (both include nut + job-work):
 *   • fullLoss — the ENTIRE compound sent is charged to the good pieces
 *     (runner/rejects treated as total loss, NOT recovered).
 *   • regrind  — recoverable regrind (runner + rejects + regrind handed back)
 *     is credited back, so only genuinely lost material is charged.
 * Real cost sits between the two.
 */
import { byId, round2, jobWorkTotal } from './costing'
import { netPlasticPerPieceG, nutsPerPiece } from './reconcile'

const active = (rows) => (rows || []).filter(r => !r.voided)
const num = (n) => Number(n) || 0

/**
 * Run efficiency from machine shots + hours vs the product's rated cycle time.
 *   actualPerHr = shots ÷ hours ;  targetPerHr = 3600 ÷ cycleSec
 * Returns null until both shots and hours are known.
 */
export function runEfficiency(shots, hours, cycleSec) {
  const s = num(shots), h = num(hours), c = num(cycleSec)
  if (s <= 0 || h <= 0) return null
  const actualPerHr = s / h
  const targetPerHr = c > 0 ? 3600 / c : 0
  const pct = targetPerHr > 0 ? round2((actualPerHr / targetPerHr) * 100) : null
  const idleHours = targetPerHr > 0 ? round2(Math.max(0, h - s / targetPerHr)) : 0
  return { actualPerHr: round2(actualPerHr), targetPerHr: round2(targetPerHr), pct, idleHours }
}

/** Distinct lots (newest first), with molder + date span, derived from issues. */
export function lotList(data) {
  const map = new Map()
  for (const i of active(data.issues)) {
    const lot = i.lotNo || ''
    if (!lot) continue
    if (!map.has(lot)) map.set(lot, { lotNo: lot, molderId: i.molderId, firstDate: i.date, lastDate: i.date })
    const e = map.get(lot)
    if (i.date < e.firstDate) e.firstDate = i.date
    if (i.date > e.lastDate) e.lastDate = i.date
  }
  return [...map.values()].sort((a, b) => (a.lotNo < b.lotNo ? 1 : -1))
}

/** Suggest the next lot number, e.g. LOT-03. */
export function nextLotNo(data) {
  const nums = active(data.issues).map(i => {
    const m = /(\d+)\s*$/.exec(i.lotNo || '')
    return m ? Number(m[1]) : 0
  })
  const n = (nums.length ? Math.max(0, ...nums) : 0) + 1
  return `LOT-${String(n).padStart(2, '0')}`
}

/** Is this lot's hisab finalized (locked)? lotLocks = [{ lotNo, finalizedAt, by }]. */
export function isLotFinalized(lotNo, lotLocks) {
  if (!lotNo) return false
  return (lotLocks || []).some(l => l.lotNo === lotNo)
}

/** Lot numbers already used by a given molder (for the production/return picker). */
export function lotsForMolder(molderId, data) {
  return lotList(data).filter(l => l.molderId === molderId).map(l => l.lotNo)
}

/**
 * Full reconciliation + costing for one lot.
 * masters = { compounds, masterbatch, inserts, molders, products }
 * data    = { issues, production, returns }
 */
export function lotReconciliation(lotNo, masters, data) {
  const issues = active(data.issues).filter(i => (i.lotNo || '') === lotNo)
  const prod = active(data.production).filter(p => (p.lotNo || '') === lotNo)
  const rets = active(data.returns).filter(r => (r.lotNo || '') === lotNo)
  const products = masters.products || []

  const molderId = issues[0]?.molderId || prod[0]?.molderId || ''
  const molder = byId(masters.molders, molderId)

  // THIS lot's product (from its issues, else its production). Used for the
  // compound/nut fallbacks — never products[0], which would borrow the FIRST
  // product's nut and wrongly show a nut + nut-cost on a no-nut lot (e.g. Knob).
  const lotProductId = issues.find(i => i.productId)?.productId || prod[0]?.items?.[0]?.productId || ''
  const lotProduct = byId(products, lotProductId)

  // ── SENT (raw material handed to the molder for this lot) ──
  const compoundKg = round2(issues.reduce((s, i) => s + num(i.compoundKg), 0))
  const nutsSent = issues.reduce((s, i) => s + num(i.nutQty), 0)
  const nutsSentKg = round2(issues.reduce((s, i) => s + num(i.nutKg), 0))
  const mbKg = round2(issues.reduce((s, i) => s + num(i.mbKg), 0))
  const compoundId = issues.find(i => i.compoundId)?.compoundId || lotProduct?.compoundId
  const cmpRate = num(byId(masters.compounds, compoundId)?.rate)
  const compoundName = byId(masters.compounds, compoundId)?.name || ''
  const insertId = issues.find(i => i.insertId)?.insertId
    || (lotProduct?.inserts || [])[0]?.insertId || ''
  const nutRate = num(byId(masters.inserts, insertId)?.rate)

  // ── RECEIVED (pieces + scrap from production tagged to this lot) ──
  let goodPieces = 0, rejectPieces = 0, runnerKg = 0, rejectsKg = 0, burntKg = 0
  let finishedKg = 0, shifts = 0, plasticInProductsKg = 0, nutsUsed = 0
  let machineShots = 0, machinePieces = 0, hoursRun = 0
  for (const e of prod) {
    runnerKg += num(e.runnerKg); rejectsKg += num(e.rejectsKg); burntKg += num(e.burntKg)
    finishedKg += num(e.finishedKg); shifts += num(e.shifts); hoursRun += num(e.hours)
    machineShots += num(e.machineShots)
    machinePieces += num(e.machineShots) * (num(byId(products, (e.items || [])[0]?.productId)?.cavities))
    for (const it of e.items || []) {
      const product = byId(products, it.productId)
      const pcs = num(it.pieces), rej = num(it.rejects)
      goodPieces += pcs; rejectPieces += rej
      plasticInProductsKg += (pcs * netPlasticPerPieceG(product)) / 1000
      nutsUsed += (pcs + rej) * nutsPerPiece(product)
    }
  }
  plasticInProductsKg = round2(plasticInProductsKg)
  runnerKg = round2(runnerKg); rejectsKg = round2(rejectsKg); burntKg = round2(burntKg)

  // ── RETURNED (material handed back against this lot) ──
  const returnedCompoundKg = round2(rets.reduce((s, r) => s + num(r.compoundKg), 0))
  const returnedRegrindKg = round2(rets.reduce((s, r) => s + num(r.regrindKg), 0))
  const returnedNuts = rets.reduce((s, r) => s + num(r.nutQty), 0)
  const returnedNutsKg = round2(rets.reduce((s, r) => s + num(r.nutKg), 0))

  // Recoverable regrind = runner + rejects + loose regrind handed back.
  const regrindKg = round2(runnerKg + rejectsKg + returnedRegrindKg)
  const accountedKg = round2(plasticInProductsKg + runnerKg + rejectsKg + burntKg + returnedCompoundKg + returnedRegrindKg)
  const balanceKg = round2(compoundKg - accountedKg)   // +ve = still with molder / unexplained
  const lossPct = compoundKg > 0 ? round2((Math.max(0, balanceKg) / compoundKg) * 100) : 0
  const yieldPct = compoundKg > 0 ? round2((plasticInProductsKg / compoundKg) * 100) : 0

  // Pending pieces = expected from the compound sent − produced so far.
  let expectedPieces = 0
  for (const i of issues) {
    const p = byId(products, i.productId)
    const g = num(p?.gPerPiece)
    if (g > 0) expectedPieces += (num(i.compoundKg) * 1000) / g
  }
  expectedPieces = Math.round(expectedPieces)
  const pendingPieces = Math.max(0, expectedPieces - goodPieces)

  const jobWork = round2(prod.reduce((s, e) => s + jobWorkTotal(e, molder), 0))
  const cycleSec = num(byId(products, prod.find(p => (p.items || [])[0])?.items?.[0]?.productId)?.cycleSec)
  const efficiency = runEfficiency(machineShots, hoursRun, cycleSec)

  // ── TWO PIECE-RATES ──
  const nutPerPiece = round2(nutRate * (goodPieces > 0 ? nutsUsed / goodPieces : nutsPerPiece(lotProduct)))
  const jobWorkPerPiece = goodPieces > 0 ? round2(jobWork / goodPieces) : 0
  const compoundFullLoss = goodPieces > 0 ? round2((compoundKg * cmpRate) / goodPieces) : 0
  const compoundNet = goodPieces > 0 ? round2((Math.max(0, compoundKg - regrindKg) * cmpRate) / goodPieces) : 0
  const rateFullLoss = round2(compoundFullLoss + nutPerPiece + jobWorkPerPiece)
  const rateRegrind = round2(compoundNet + nutPerPiece + jobWorkPerPiece)

  // Nut weight can differ lot to lot: prefer the actual weighed kg on the issues
  // (avg g/nut), fall back to the master weight for lots with no per-entry kg.
  const masterNutG = num(byId(masters.inserts, insertId)?.weightG)
  const avgNutG = nutsSent > 0 && nutsSentKg > 0 ? (nutsSentKg * 1000) / nutsSent : masterNutG

  return {
    lotNo, molder, molderId, compoundName, firstDate: issues[0]?.date || prod[0]?.date || '',
    hasData: issues.length + prod.length + rets.length > 0,
    // grams/piece for the "pieces (kg)" display rule (owner 2026-07-01):
    // finished-piece weight for produced pieces; nut movements use the ACTUAL
    // weighed kg (nut size differs lot to lot), with a per-lot average g/nut for
    // the residual balance. Falls back to the master weight when a lot pre-dates
    // per-entry nut weights (keeps lot-level consistent with the per-entry views).
    pieceG: num(lotProduct?.finishedPieceG),
    nutWeightG: masterNutG,
    nutsSentKg: nutsSentKg > 0 ? nutsSentKg : round2((nutsSent * masterNutG) / 1000),
    returnedNutsKg: returnedNutsKg > 0 ? returnedNutsKg : round2((returnedNuts * masterNutG) / 1000),
    nutBalanceKg: round2(((nutsSent - nutsUsed - returnedNuts) * avgNutG) / 1000),
    sent: { compoundKg, nutsSent, mbKg, cmpRate, nutRate },
    received: { goodPieces, rejectPieces, runnerKg, rejectsKg, burntKg, finishedKg, plasticInProductsKg, nutsUsed, shifts, hoursRun, machineShots, machinePieces },
    efficiency,
    returned: { compoundKg: returnedCompoundKg, regrindKg: returnedRegrindKg, nuts: returnedNuts },
    regrindKg, accountedKg, balanceKg, lossPct, yieldPct,
    expectedPieces, pendingPieces,
    nutBalance: nutsSent - nutsUsed - returnedNuts,
    jobWork,
    rates: { fullLoss: rateFullLoss, regrind: rateRegrind, compoundFullLoss, compoundNet, nutPerPiece, jobWorkPerPiece },
    flag: balanceKg < -2,   // consumed more plastic than was sent → check
  }
}
