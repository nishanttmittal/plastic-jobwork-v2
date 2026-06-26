/**
 * Material reconciliation (pure functions).
 *
 * Ties every kg of compound issued to a molder against what came back:
 *   issued = plastic in finished product (taken back)
 *          + runner returned  (regrind)
 *          + rejects returned (scrap, regrind)
 *          + burnt / purge loss (destroyed — owner's loss)
 *          + material physically RETURNED unused (compound + regrind handed back)
 *          + balance still lying with the molder
 *
 * A 🚩 flag is raised when a molder appears to have consumed MORE than issued
 * (beyond tolerance) — the signal that weights/counts don't add up.
 */
import { byId, round2 } from './costing'
import { RECON_TOLERANCE_KG } from '../config'

/** Total nuts a product uses per piece (sum across its inserts). */
export function nutsPerPiece(product) {
  if (!product) return 0
  return (product.inserts || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)
}

/**
 * NET plastic actually in one finished piece (grams) — used for MATERIAL
 * reconciliation (how much of the issued compound ended up in product).
 *
 * This is deliberately DIFFERENT from `gPerPiece`, which is the compound
 * *consumed* per piece INCLUDING runner + purge waste and is used for COSTING.
 * Using gPerPiece here over-counts (it double-charges the runner/rejects that
 * are also added back separately) and raised false 🚩 shortage flags.
 *
 * Falls back to gPerPiece when netPartG isn't set, so products that haven't
 * been weighed yet reconcile exactly as before (backward compatible).
 */
export function netPlasticPerPieceG(product) {
  const net = Number(product?.netPartG) || 0
  return net > 0 ? net : (Number(product?.gPerPiece) || 0)
}

const active = (rows) => (rows || []).filter(r => !r.voided)

/**
 * Reconcile one molder.
 * data = { issues, production, returns, products }
 * `returns` is optional — when absent (or empty) the result is identical to the
 * pre-returns behaviour, so every existing caller keeps working unchanged.
 */
export function molderBalance(molderId, data) {
  const issues = active(data.issues).filter(i => i.molderId === molderId)
  const entries = active(data.production).filter(p => p.molderId === molderId)
  const returns = active(data.returns).filter(r => r.molderId === molderId)
  const products = data.products || []

  const issuedKg = round2(issues.reduce((s, i) => s + (Number(i.compoundKg) || 0), 0))
  const nutsIssued = issues.reduce((s, i) => s + (Number(i.nutQty) || 0), 0)
  const mbIssuedKg = round2(issues.reduce((s, i) => s + (Number(i.mbKg) || 0), 0))

  // Material the molder physically handed back (reduces what's still with him).
  const returnedCompoundKg = round2(returns.reduce((s, r) => s + (Number(r.compoundKg) || 0), 0))
  const returnedRegrindKg = round2(returns.reduce((s, r) => s + (Number(r.regrindKg) || 0), 0))
  const returnedNuts = returns.reduce((s, r) => s + (Number(r.nutQty) || 0), 0)
  const returnedKg = round2(returnedCompoundKg + returnedRegrindKg)

  let plasticInProductsKg = 0
  let nutsUsed = 0
  let runnerKg = 0, rejectsKg = 0, burntKg = 0, goodPieces = 0
  for (const e of entries) {
    runnerKg += Number(e.runnerKg) || 0
    rejectsKg += Number(e.rejectsKg) || 0
    burntKg += Number(e.burntKg) || 0
    for (const it of e.items || []) {
      const product = byId(products, it.productId)
      const pcs = Number(it.pieces) || 0
      const rej = Number(it.rejects) || 0
      goodPieces += pcs
      plasticInProductsKg += (pcs * netPlasticPerPieceG(product)) / 1000
      nutsUsed += (pcs + rej) * nutsPerPiece(product)
    }
  }
  plasticInProductsKg = round2(plasticInProductsKg)
  runnerKg = round2(runnerKg)
  rejectsKg = round2(rejectsKg)
  burntKg = round2(burntKg)

  const accountedKg = round2(plasticInProductsKg + runnerKg + rejectsKg + burntKg)
  // Balance still lying with the molder = issued − consumed/returned-via-production
  // − material he physically handed back (unused compound + loose regrind).
  const balanceKg = round2(issuedKg - accountedKg - returnedKg)
  const regrindKg = round2(runnerKg + rejectsKg) // reusable returned stock

  // Expected pieces from the compound issued (yield estimate): for each issue
  // that names a product, kg ÷ grams-per-piece. Produced pieces draw it down.
  let expectedPieces = 0
  for (const i of issues) {
    const p = byId(products, i.productId)
    const g = Number(p?.gPerPiece) || 0
    if (g > 0) expectedPieces += ((Number(i.compoundKg) || 0) * 1000) / g
  }
  expectedPieces = Math.round(expectedPieces)
  const producedPieces = goodPieces
  const pendingPieces = Math.max(0, expectedPieces - producedPieces)

  return {
    molderId,
    issuedKg, mbIssuedKg,
    plasticInProductsKg, runnerKg, rejectsKg, burntKg,
    returnedCompoundKg, returnedRegrindKg, returnedKg, returnedNuts,
    accountedKg, balanceKg, regrindKg,
    goodPieces,
    expectedPieces, producedPieces, pendingPieces,
    nutsIssued, nutsUsed, nutBalance: nutsIssued - nutsUsed - returnedNuts,
    flag: balanceKg < -RECON_TOLERANCE_KG,
  }
}

/** Reconcile every molder that has any activity. */
export function allMolderBalances(masters, data) {
  const ids = new Set([
    ...active(data.issues).map(i => i.molderId),
    ...active(data.production).map(p => p.molderId),
    ...active(data.returns).map(r => r.molderId),
  ])
  return [...ids].map(id => ({
    molder: byId(masters.molders, id),
    ...molderBalance(id, { ...data, products: masters.products }),
  }))
}
