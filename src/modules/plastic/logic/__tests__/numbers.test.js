/**
 * Number-safety guard for the rebuild. These assert the REAL, verified
 * KUPPA-01 figures so a future change to the logic can't silently move the
 * money. Values come from the live data dump (2026-06-26).
 */
import { describe, it, expect } from 'vitest'
import { productMaterialCost, jobWorkTotal } from '../costing'
import { netPlasticPerPieceG, nutsPerPiece } from '../reconcile'
import { lotReconciliation } from '../lot'
import { materialStock } from '../stock'
import { molderBalance } from '../reconcile'
import { fmtPcsKg, fmtCountKg } from '../../../../core/utils/format'

const kuppa = {
  id: 'prd_cap', name: 'Kuppa', compoundId: 'cmp_pp',
  gPerPiece: 38.9, netPartG: 36, finishedPieceG: 45, cavities: 4,
  inserts: [{ insertId: 'nut_a', qty: 1 }],
}
const masters = {
  compounds: [{ id: 'cmp_pp', rate: 80, reorder: 500 }],
  inserts: [{ id: 'nut_a', rate: 1.5, weightG: 8.3, reorder: 25000 }],
  molders: [{ id: 'mld_1', shiftRate: 4500, gst: false }],
  products: [kuppa], masterbatch: [],
}
const data = {
  // nuts recorded BY WEIGHT (owner rule): 150 kg @ 8.3 g = 18,072; 46.05 kg = 5,548 back
  issues: [{ lotNo: 'KUPPA-01', molderId: 'mld_1', compoundId: 'cmp_pp', compoundKg: 450, productId: 'prd_cap', insertId: 'nut_a', nutKg: 150, nutQty: 18072 }],
  production: [{ lotNo: 'KUPPA-01', molderId: 'mld_1', hours: 42.5, items: [{ productId: 'prd_cap', pieces: 11928, rejects: 0 }] }],
  returns: [{ lotNo: 'KUPPA-01', molderId: 'mld_1', insertId: 'nut_a', nutKg: 46.05, nutQty: 5548 }],
}

describe('costing', () => {
  it('Kuppa material cost = ₹4.61/pc (compound 3.11 + nut 1.50)', () => {
    expect(productMaterialCost(kuppa, masters).total).toBeCloseTo(4.61, 2)
  })
  it('PLW-0001 job-work = ₹15,937.50 (42.5 hr / 12 × 4500)', () => {
    expect(jobWorkTotal(data.production[0], masters.molders[0])).toBeCloseTo(15937.5, 1)
  })
})

describe('reconcile', () => {
  it('net plastic 36 g, 1 nut/piece', () => {
    expect(netPlasticPerPieceG(kuppa)).toBe(36)
    expect(nutsPerPiece(kuppa)).toBe(1)
  })
})

describe('lot KUPPA-01', () => {
  const r = lotReconciliation('KUPPA-01', masters, data)
  it('nut balance = 596 (18072 − 11928 used − 5548 returned)', () => expect(r.nutBalance).toBe(596))
  it('no over-consumption flag', () => expect(r.flag).toBe(false))
  it('exposes grams/piece for the weight-in-brackets display', () => {
    expect(r.nutWeightG).toBe(8.3)   // nut master weight (fallback)
    expect(r.pieceG).toBe(45)        // finished Kuppa piece (incl nut)
  })
  it('nuts shown by TRUE weighed kg (differs lot to lot)', () => {
    expect(r.nutsSentKg).toBe(150)          // actual weighed supply
    expect(r.returnedNutsKg).toBeCloseTo(46.05, 2)
    expect(r.nutBalanceKg).toBeCloseTo(4.95, 1) // 596 × 8.3 g avg
  })
})

describe('molderBalance nut weight (per-lot weighed kg)', () => {
  const b = molderBalance('mld_1', { issues: data.issues, production: data.production, returns: data.returns, products: masters.products })
  it('nuts issued kg = 150, balance kg ≈ 4.95', () => {
    expect(b.nutsIssuedKg).toBe(150)
    expect(b.nutBalance).toBe(596)
    expect(b.nutBalanceKg).toBeCloseTo(4.95, 1)
  })
})

describe('weight-in-brackets formatters (owner rule 2026-07-01)', () => {
  it('fmtCountKg nuts by true kg: 18,072 / 150 kg → "18,072 (150 kg)"', () => expect(fmtCountKg(18072, 150)).toBe('18,072 (150 kg)'))
  it('fmtCountKg small: 596 / 4.95 kg → "596 (4.95 kg)"', () => expect(fmtCountKg(596, 4.95)).toBe('596 (4.95 kg)'))
  it('fmtCountKg no kg → plain count', () => expect(fmtCountKg(5000, 0)).toBe('5,000'))
  it('fmtPcsKg pieces: 11,928 @ 45 g → "11,928 (537 kg)"', () => expect(fmtPcsKg(11928, 45)).toBe('11,928 (537 kg)'))
  it('fmtPcsKg no weight → plain count', () => expect(fmtPcsKg(5000, 0)).toBe('5,000'))
})

describe('no-nut lot (Knob) must not borrow another product’s nut', () => {
  // A product with NO inserts, issued without a nut. The lot must show zero nut
  // rate / zero nut cost — it must NOT fall back to the first product's nut.
  const knob = { id: 'prd_knob', name: 'Knob', compoundId: 'cmp_pp_knob', gPerPiece: 27.25, netPartG: 26, cavities: 4, inserts: [] }
  const m2 = { ...masters, compounds: [...masters.compounds, { id: 'cmp_pp_knob', rate: 85 }], products: [kuppa, knob] }
  const d2 = {
    issues: [{ lotNo: 'KNOB-01', molderId: 'mld_1', compoundId: 'cmp_pp_knob', compoundKg: 500, productId: 'prd_knob' }],
    production: [], returns: [],
  }
  const r = lotReconciliation('KNOB-01', m2, d2)
  it('nuts sent = 0', () => expect(r.sent.nutsSent).toBe(0))
  it('nut rate = ₹0 (no phantom Kuppa nut)', () => expect(r.sent.nutRate).toBe(0))
  it('nut cost per piece = ₹0', () => expect(r.rates.nutPerPiece).toBe(0))
})

describe('stock', () => {
  it('nut stock = +5548 (18072 bought − 18072 issued + 5548 returned)', () => {
    const purchases = [{ kind: 'nut', materialId: 'nut_a', qty: 18072, rate: 1.5 }]
    const nut = materialStock(masters, { purchases, issues: data.issues, returns: data.returns }).inserts[0]
    expect(nut.stock).toBe(5548)
  })
})
