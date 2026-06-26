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

const kuppa = {
  id: 'prd_cap', name: 'Kuppa', compoundId: 'cmp_pp',
  gPerPiece: 38.9, netPartG: 36, cavities: 4,
  inserts: [{ insertId: 'nut_a', qty: 1 }],
}
const masters = {
  compounds: [{ id: 'cmp_pp', rate: 80, reorder: 500 }],
  inserts: [{ id: 'nut_a', rate: 1.5, weightG: 8.3, reorder: 25000 }],
  molders: [{ id: 'mld_1', shiftRate: 4500, gst: false }],
  products: [kuppa], masterbatch: [],
}
const data = {
  issues: [{ lotNo: 'KUPPA-01', molderId: 'mld_1', compoundId: 'cmp_pp', compoundKg: 450, productId: 'prd_cap', insertId: 'nut_a', nutQty: 18000 }],
  production: [{ lotNo: 'KUPPA-01', molderId: 'mld_1', hours: 42.5, items: [{ productId: 'prd_cap', pieces: 11928, rejects: 0 }] }],
  returns: [{ lotNo: 'KUPPA-01', insertId: 'nut_a', nutQty: 5548 }],
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
  it('nut balance = 524 (18000 − 11928 used − 5548 returned)', () => expect(r.nutBalance).toBe(524))
  it('no over-consumption flag', () => expect(r.flag).toBe(false))
})

describe('stock', () => {
  it('nut stock = +5548 (18000 bought − 18000 issued + 5548 returned)', () => {
    const purchases = [{ kind: 'nut', materialId: 'nut_a', qty: 18000, rate: 1.5 }]
    const nut = materialStock(masters, { purchases, issues: data.issues, returns: data.returns }).inserts[0]
    expect(nut.stock).toBe(5548)
  })
})
