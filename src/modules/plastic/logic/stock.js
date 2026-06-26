/**
 * Material stock (pure functions). Stock is DERIVED from movements — never
 * stored mutable — so it is always auditable:
 *
 *   compound kg = Σ purchases − Σ issued to molders + Σ returned (unused + regrind)
 *   nuts        = Σ purchases − Σ issued              + Σ returned
 *
 * Also returns the lot-price view: average purchase rate and the latest lot
 * rate, so costing can follow real (per-purchase) material prices.
 */
import { round2 } from './costing'

const active = (rows) => (rows || []).filter(r => !r.voided)
const num = (n) => Number(n) || 0

function priceView(bought, fallbackRate) {
  const inQty = bought.reduce((s, p) => s + num(p.qty), 0)
  const spend = bought.reduce((s, p) => s + num(p.qty) * num(p.rate), 0)
  const avg = inQty > 0 ? round2(spend / inQty) : num(fallbackRate)
  const latest = bought.length
    ? num([...bought].sort((a, b) => (a.date < b.date ? 1 : -1))[0].rate)
    : num(fallbackRate)
  return { inQty: round2(inQty), spend: round2(spend), avg, latest }
}

/** Stock for every compound + nut/insert. data = {purchases, issues, returns}. */
export function materialStock(masters, data) {
  const P = active(data.purchases), I = active(data.issues), R = active(data.returns)

  const compounds = (masters.compounds || []).map(c => {
    const bought = P.filter(p => p.kind === 'compound' && p.materialId === c.id)
    const issued = I.filter(i => i.compoundId === c.id).reduce((s, i) => s + num(i.compoundKg), 0)
    const returned = R.filter(r => r.compoundId === c.id).reduce((s, r) => s + num(r.compoundKg) + num(r.regrindKg), 0)
    const pv = priceView(bought, c.rate)
    const reorder = num(c.reorder)
    const stock = round2(pv.inQty - issued + returned)
    return { id: c.id, name: c.name, unit: 'kg', kind: 'compound', stock, reorder,
      low: reorder > 0 && stock <= reorder, ...pv, masterRate: num(c.rate) }
  })

  const inserts = (masters.inserts || []).map(n => {
    const bought = P.filter(p => p.kind === 'nut' && p.materialId === n.id)
    const issued = I.filter(i => i.insertId === n.id).reduce((s, i) => s + num(i.nutQty), 0)
    const returned = R.filter(r => r.insertId === n.id).reduce((s, r) => s + num(r.nutQty), 0)
    const pv = priceView(bought, n.rate)
    const reorder = num(n.reorder)
    const stock = round2(pv.inQty - issued + returned)
    return { id: n.id, name: n.name, unit: 'pcs', kind: 'nut', stock, reorder,
      low: reorder > 0 && stock <= reorder, ...pv, masterRate: num(n.rate) }
  })

  const lowItems = [...compounds, ...inserts].filter(x => x.low)
  return { compounds, inserts, all: [...compounds, ...inserts], lowItems }
}
