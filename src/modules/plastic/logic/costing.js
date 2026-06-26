/**
 * Costing logic (pure functions) — the heart of the app.
 *
 * Cost per piece =
 *     compound (g/piece × ₹/kg)
 *   + masterbatch (g × dose% × ₹/kg)
 *   + nut/inserts (qty × ₹ each)
 *   + job-work share (₹shift-cost ÷ total pieces in the shift, split across products)
 *
 * Job work is a FIXED ₹/shift, so cost-per-piece falls as output rises — the
 * key profitability lever this app surfaces.
 */
import { ENTRY_PREFIX } from '../config'

export const byId = (list, id) => (list || []).find(x => x.id === id) || null

/** Zero-padded entry number, e.g. PLW-0007. */
export const formatEntryNo = (n) => `${ENTRY_PREFIX}-${String(n).padStart(4, '0')}`

/**
 * Material cost per piece for a product (compound + masterbatch + nuts).
 * masters = { compounds, masterbatch, inserts }
 * @returns {{compound:number, masterbatch:number, nut:number, total:number}}
 */
export function productMaterialCost(product, masters) {
  if (!product) return { compound: 0, masterbatch: 0, nut: 0, total: 0 }
  const cmp = byId(masters.compounds, product.compoundId)
  const mb = byId(masters.masterbatch, product.mbId)

  const g = Number(product.gPerPiece) || 0
  const compound = (g / 1000) * (cmp ? Number(cmp.rate) || 0 : 0)

  const mbG = g * ((Number(product.mbPct) || 0) / 100)
  const masterbatch = (mbG / 1000) * (mb ? Number(mb.rate) || 0 : 0)

  let nut = 0
  for (const ins of product.inserts || []) {
    const m = byId(masters.inserts, ins.insertId)
    nut += (Number(ins.qty) || 0) * (m ? Number(m.rate) || 0 : 0)
  }
  return {
    compound: round2(compound),
    masterbatch: round2(masterbatch),
    nut: round2(nut),
    total: round2(compound + masterbatch + nut),
  }
}

/**
 * Shift-equivalents charged for an entry. If actual `hours` are recorded, pay
 * is pro-rata on a 12-hr shift (hours ÷ 12); otherwise whole `shifts`.
 */
export function shiftEquivalents(entry) {
  const hours = Number(entry?.hours) || 0
  return hours > 0 ? hours / 12 : (Number(entry?.shifts) || 0)
}

/** Pay mode in force for an entry: explicit override, else molder default, else time. */
export function payModeOf(entry, molder) {
  return entry?.payMode || molder?.payMode || 'time'
}

/**
 * Job-work cost for an entry. Two ways, selectable per molder or per entry:
 *   • time  — shift-equivalents × shift-rate (whole shifts OR pro-rata hours)
 *   • piece — good pieces × piece-rate
 * (+GST when the molder bills it.)
 */
export function jobWorkTotal(entry, molder) {
  // Finalized entries carry a frozen pay value so later rate changes can't
  // alter a settled lot's dues. (Cleared again on reopen.)
  if (entry?.locked) return round2(Number(entry.lockedJobWork) || 0)
  if (!molder) return 0
  let base
  if (payModeOf(entry, molder) === 'piece') {
    const pieces = (entry?.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
    const rate = Number(entry?.pieceRate) > 0 ? Number(entry.pieceRate) : (Number(molder.pieceRate) || 0)
    base = pieces * rate
  } else {
    base = shiftEquivalents(entry) * (Number(molder.shiftRate) || 0)
  }
  const withGst = molder.gst ? base * (1 + (Number(molder.gstPct) || 0) / 100) : base
  return round2(withGst)
}

/**
 * Full costing for one production entry.
 * masters = { compounds, masterbatch, inserts, molders, products }
 * @returns {{
 *   perProduct: Array<{productId,name,pieces,rejects,material,jobWork,costPerPiece,totalCost}>,
 *   totalGoodPieces:number, jobWork:number, jobWorkPerPiece:number, grandTotal:number
 * }}
 */
export function entryCosting(entry, masters) {
  const molder = byId(masters.molders, entry.molderId)
  const jw = jobWorkTotal(entry, molder)

  const items = entry.items || []
  const totalGoodPieces = items.reduce((s, it) => s + (Number(it.pieces) || 0), 0)
  const jobWorkPerPiece = totalGoodPieces > 0 ? jw / totalGoodPieces : 0

  const perProduct = items.map(it => {
    const product = byId(masters.products, it.productId)
    const mat = productMaterialCost(product, masters)
    const pieces = Number(it.pieces) || 0
    const costPerPiece = round2(mat.total + jobWorkPerPiece)
    return {
      productId: it.productId,
      name: product ? product.name : '(unknown)',
      pieces,
      rejects: Number(it.rejects) || 0,
      material: mat,
      jobWork: round2(jobWorkPerPiece),
      costPerPiece,
      totalCost: round2(costPerPiece * pieces),
    }
  })

  return {
    perProduct,
    totalGoodPieces,
    jobWork: jw,
    jobWorkPerPiece: round2(jobWorkPerPiece),
    grandTotal: round2(perProduct.reduce((s, p) => s + p.totalCost, 0)),
  }
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}
