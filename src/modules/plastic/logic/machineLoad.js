/**
 * Machine load & buy-signal — answers "is my plastic volume big enough to buy
 * my own moulding machine yet?" using the REAL run data (machine shots, hours,
 * cycle times) captured on production entries.
 *
 * It adds up the machine-hours your work needs across ALL products over a
 * window, scales it to a month, and shows how full one machine would be. The
 * rule (per the make-vs-buy analysis): buy when your volume fills a machine —
 * idle capacity is wasted capital.
 */
import { byId, round2, jobWorkTotal } from './costing'
import { MACHINE_ECONOMICS, MACHINE_CAPACITY } from '../config'

const active = (rows) => (rows || []).filter(r => !r.voided)
const num = (n) => Number(n) || 0

/** Machine-seconds one production entry consumed (best estimate). */
function entrySeconds(e, products) {
  if (num(e.hours) > 0) return num(e.hours) * 3600   // actual hours = best
  // shots × the product's cycle time
  const p0 = byId(products, (e.items || [])[0]?.productId)
  const cyc0 = num(p0?.cycleSec)
  if (num(e.machineShots) > 0 && cyc0 > 0) return num(e.machineShots) * cyc0
  // else derive from pieces ÷ cavities × cycle
  let sec = 0
  for (const it of e.items || []) {
    const p = byId(products, it.productId)
    const cav = num(p?.cavities) || 1
    sec += ((num(it.pieces) + num(it.rejects)) / cav) * num(p?.cycleSec)
  }
  return sec
}

export function machineLoad(masters, data, days = 30) {
  const products = masters.products || []
  const sinceStr = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = active(data.production).filter(p => (p.date || '') >= sinceStr)

  let pieces = 0, shots = 0, sec = 0, outsource = 0
  const perProduct = {}
  for (const e of rows) {
    outsource += jobWorkTotal(e, byId(masters.molders, e.molderId))
    sec += entrySeconds(e, products)
    shots += num(e.machineShots)
    for (const it of e.items || []) {
      const pcs = num(it.pieces)
      pieces += pcs
      const name = byId(products, it.productId)?.name || 'product'
      perProduct[name] = (perProduct[name] || 0) + pcs
    }
  }
  const hours = round2(sec / 3600)

  // Scale the window up to a month.
  const f = days > 0 ? 30 / days : 0
  const moPieces = Math.round(pieces * f)
  const moHours = round2(hours * f)
  const moSpend = round2(outsource * f)

  // One machine's monthly capacity.
  const C = MACHINE_CAPACITY
  const oneShiftHrs = C.workingDays * C.hoursPerShift           // 1 shift/day
  const twoShiftHrs = oneShiftHrs * 2                            // 2 shifts/day
  const fill1 = oneShiftHrs > 0 ? round2((moHours / oneShiftHrs) * 100) : 0
  const fill2 = twoShiftHrs > 0 ? round2((moHours / twoShiftHrs) * 100) : 0

  // In-house conversion cost per piece (fixed monthly ÷ pieces) vs what you pay
  // the moulder now (real average, falling back to the configured estimate).
  const E = MACHINE_ECONOMICS
  // Electricity scales with running hours: avg kW (servo load + chiller) × hrs × ₹/unit.
  const avgKw = round2(E.motorKw * E.loadFactor + E.chillerKw)
  const monthlyElectricity = round2(avgKw * moHours * E.elecRatePerKwh)
  const monthlyFixed = E.monthlyOperator + E.monthlyRent + E.monthlyMaintenance
    + E.machineCost / E.lifeYears / 12
  const monthlyTotal = round2(monthlyFixed + monthlyElectricity)
  const inhousePerPiece = moPieces > 0 ? round2(monthlyTotal / moPieces) : null
  const outsourcePerPiece = moPieces > 0 ? round2(moSpend / moPieces) : E.outsourcePerPiece
  const cheaperInhouse = inhousePerPiece != null && inhousePerPiece <= outsourcePerPiece
  const savingPerPiece = inhousePerPiece != null ? round2(outsourcePerPiece - inhousePerPiece) : null
  const paybackMonths = (savingPerPiece > 0 && moPieces > 0)
    ? round2(E.machineCost / (savingPerPiece * moPieces)) : null

  // Verdict: machine must be reasonably full AND cheaper in-house.
  const goodPayback = paybackMonths != null && paybackMonths > 0 && paybackMonths <= 30
  let verdict, reason
  if (moPieces === 0) { verdict = 'nodata'; reason = 'Record some production (with hours/shots) to build the picture.' }
  else if (cheaperInhouse && fill1 >= 80 && goodPayback) { verdict = 'buy'; reason = `Machine runs near-full, cheaper in-house, payback ~${paybackMonths} months.` }
  else if (cheaperInhouse && fill1 >= 80) { verdict = 'getting-close'; reason = `Machine would be full and in-house is cheaper, but payback is long (~${paybackMonths} mo) — outsource rate is already low; the buy-case is stronger with slower/higher-value products.` }
  else if (cheaperInhouse && fill1 >= 50) { verdict = 'getting-close'; reason = 'In-house is cheaper, but the machine would still be part-idle — volume rising, watch it.' }
  else if (fill1 >= 80) { verdict = 'getting-close'; reason = 'Lots of volume, but in-house isn’t cheaper yet — negotiate moulder rate or wait.' }
  else { verdict = 'outsource'; reason = 'Volume too low to fill a machine — keep outsourcing, ₹25L would sit idle.' }

  return {
    days, sinceStr,
    window: { pieces, shots, hours },
    monthly: { pieces: moPieces, hours: moHours, spend: moSpend },
    capacity: { oneShiftHrs, twoShiftHrs, fill1, fill2 },
    economics: { inhousePerPiece, outsourcePerPiece, cheaperInhouse, savingPerPiece, paybackMonths, machineCost: E.machineCost,
      avgKw, monthlyElectricity, monthlyFixed: round2(monthlyFixed), monthlyTotal },
    perProduct: Object.entries(perProduct).map(([name, pcs]) => ({ name, pieces: pcs })).sort((a, b) => b.pieces - a.pieces),
    verdict, reason,
  }
}
