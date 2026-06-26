/**
 * Issue Material — record compound / masterbatch / nuts handed to a molder
 * (bulk or per-job). Feeds the molder's running material balance.
 */
import { useState } from 'react'
import { usePlastic } from '../PlasticContext'
import {
  Button, Card, FieldLabel, Select, NumberInput, DateInput, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtNum } from '../../../core/utils/format'
import { molderBalance } from '../logic/reconcile'
import { byId } from '../logic/costing'
import { nextLotNo, lotList, isLotFinalized } from '../logic/lot'

export default function IssueCompound() {
  const { molders, compounds, masterbatch, inserts, masters, issues, production, returns, log, lotLocks } = usePlastic()
  const { msg, show } = useToast()

  const [date, setDate] = useState(todayStr())
  const [molderId, setMolderId] = useState(molders[0]?.id || '')
  const [lotNo, setLotNo] = useState(() => nextLotNo({ issues: issues.list }))
  const existingLots = lotList({ issues: issues.list }).map(l => l.lotNo)
  const [compoundId, setCompoundId] = useState(compounds[0]?.id || '')
  const [compoundKg, setCompoundKg] = useState('')
  const [productId, setProductId] = useState(masters.products.find(p => (Number(p.gPerPiece) || 0) > 0)?.id || '')
  const [mbId, setMbId] = useState('')
  const [mbKg, setMbKg] = useState('')
  const [insertId, setInsertId] = useState('')
  const [nutKg, setNutKg] = useState('')
  const [note, setNote] = useState('')

  // Nuts are weighed, not counted: derive the count from weight ÷ nut weight.
  const nutWeightG = Number(byId(inserts, insertId)?.weightG) || 0
  const derivedNutQty = (Number(nutKg) > 0 && nutWeightG > 0) ? Math.round(Number(nutKg) * 1000 / nutWeightG) : 0

  const molderOpts = molders.map(m => ({ value: m.id, label: m.name }))
  const compoundOpts = compounds.map(c => ({ value: c.id, label: `${c.name} · ₹${c.rate}/kg` }))
  const mbOpts = [{ value: '', label: '— none —' }, ...masterbatch.map(m => ({ value: m.id, label: m.name }))]
  const nutOpts = [{ value: '', label: '— none —' }, ...inserts.map(i => ({ value: i.id, label: `${i.name} · ₹${i.rate}` }))]
  const productOpts = masters.products.map(p => ({ value: p.id, label: p.name }))

  // Live yield estimate: how many pieces this compound should make.
  const selProduct = byId(masters.products, productId)
  const gpp = Number(selProduct?.gPerPiece) || 0
  const expectedFromThis = gpp > 0 ? Math.round(((Number(compoundKg) || 0) * 1000) / gpp) : 0

  const bal = molderId ? molderBalance(molderId, { issues: issues.list, production: production.list, returns: returns.list, products: masters.products }) : null

  const canSave = molderId && ((Number(compoundKg) || 0) > 0 || (Number(nutKg) || 0) > 0 || (Number(mbKg) || 0) > 0)

  const save = () => {
    if (!canSave) { show('Enter a quantity to issue', 2500); return }
    if (isLotFinalized(lotNo.trim(), lotLocks)) { show('🔒 That lot is finalized — reopen it first', 3000); return }
    if (insertId && !(nutWeightG > 0)) { show("Set this nut's weight (g each) in Masters → Nuts first", 3500); return }
    if (insertId && !(Number(nutKg) > 0)) { show('⚖️ Nut weight (kg) is required when supplying nuts', 3000); return }
    issues.insert({
      date, molderId, lotNo: lotNo.trim(),
      compoundId, compoundKg: Number(compoundKg) || 0, productId,
      mbId, mbKg: Number(mbKg) || 0,
      insertId, nutKg: Number(nutKg) || 0, nutQty: derivedNutQty,
      note, voided: false, createdAt: new Date().toISOString(),
    })
    const m = byId(molders, molderId)
    log('ISSUE', `${m?.name || molderId} · ${fmtNum(compoundKg) || 0}kg · ${fmtNum(nutKg) || 0}kg (${fmtNum(derivedNutQty)}) nuts`)
    show('✅ Material issued', 2000)
    setCompoundKg(''); setMbKg(''); setNutKg(''); setNote('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Card className="p-4 space-y-3">
        <div>
          <FieldLabel>Date</FieldLabel>
          <DateInput value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <FieldLabel>Molder</FieldLabel>
          <Select options={molderOpts} value={molderId} onChange={e => setMolderId(e.target.value)} className="mt-1" />
        </div>
        <div>
          <FieldLabel>Lot</FieldLabel>
          <input value={lotNo} onChange={e => setLotNo(e.target.value)} list="plw-lots" placeholder="LOT-01"
            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-mono mt-1" />
          <datalist id="plw-lots">{existingLots.map(l => <option key={l} value={l} />)}</datalist>
          <div className="text-[11px] text-slate-400 mt-1">New material = new lot. Reuse a lot to add more to it.</div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>Compound</FieldLabel>
        <Select options={compoundOpts} value={compoundId} onChange={e => setCompoundId(e.target.value)} />
        <div>
          <span className="text-xs text-slate-500">Compound weight (kg)</span>
          <NumberInput value={compoundKg} onChange={e => setCompoundKg(e.target.value)} placeholder="0" className="mt-1" />
        </div>
        <div>
          <span className="text-xs text-slate-500">For product (to estimate pieces)</span>
          <Select options={productOpts} value={productId} onChange={e => setProductId(e.target.value)} className="mt-1" />
        </div>
        {expectedFromThis > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
            <div className="text-3xl font-bold text-teal-800">≈ {fmtNum(expectedFromThis)} pcs</div>
            <div className="text-xs text-slate-500 mt-0.5">expected from {fmtNum(compoundKg)} kg of {selProduct?.name}</div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>Masterbatch (optional)</FieldLabel>
        <Select options={mbOpts} value={mbId} onChange={e => setMbId(e.target.value)} />
        <div>
          <span className="text-xs text-slate-500">Masterbatch weight (kg)</span>
          <NumberInput value={mbKg} onChange={e => setMbKg(e.target.value)} placeholder="0" className="mt-1" />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>Nuts supplied (by weight)</FieldLabel>
        <Select options={nutOpts} value={insertId} onChange={e => setInsertId(e.target.value)} />
        {insertId && (
          <div>
            <span className="text-xs font-semibold text-red-600">Nuts — weight (kg) · required when supplying nuts *</span>
            <NumberInput value={nutKg} onChange={e => setNutKg(e.target.value)} placeholder="0" className="mt-1" />
            {derivedNutQty > 0 && (
              <div className="mt-1 bg-teal-50 text-teal-800 rounded-xl px-3 py-2 text-sm font-semibold">
                ≈ <b>{fmtNum(derivedNutQty)}</b> nuts (at {fmtNum(nutWeightG)} g each)
              </div>
            )}
          </div>
        )}
      </Card>

      {bal && (
        <Card className="p-4 bg-slate-50">
          <FieldLabel>Currently with this molder</FieldLabel>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-slate-600">Compound balance</span>
            <span className="font-mono font-bold">{fmtNum(bal.balanceKg)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Nuts balance</span>
            <span className="font-mono font-bold">{fmtNum(bal.nutBalance)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2 mt-1">
            <span className="text-slate-600">Pending pieces (approx)</span>
            <span className="font-mono font-bold text-teal-700">{fmtNum(bal.pendingPieces)}</span>
          </div>
        </Card>
      )}

      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
        className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-base" rows={2} />

      <Button variant="success" size="lg" className="w-full" disabled={!canSave} onClick={save}>
        Issue Material
      </Button>
    </div>
  )
}
