/**
 * Return Material — record material the molder physically HANDS BACK: unused
 * virgin compound, loose regrind/runner, and/or leftover nuts. This is the
 * counterpart to "Issue Material": issuing adds to his balance, returning
 * removes from it. Additive — does not touch production or costing.
 */
import { useState } from 'react'
import { usePlastic } from '../PlasticContext'
import {
  Button, Card, FieldLabel, Select, NumberInput, DateInput, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtNum } from '../../../core/utils/format'
import { molderBalance } from '../logic/reconcile'
import { byId } from '../logic/costing'
import { lotsForMolder, isLotFinalized } from '../logic/lot'

export default function ReturnMaterial() {
  const { molders, compounds, inserts, masters, issues, production, returns, log, lotLocks } = usePlastic()
  const { msg, show } = useToast()

  const [date, setDate] = useState(todayStr())
  const [molderId, setMolderId] = useState(molders[0]?.id || '')
  const [lotNo, setLotNo] = useState('')
  const [compoundId, setCompoundId] = useState(compounds[0]?.id || '')
  const [compoundKg, setCompoundKg] = useState('')
  const [regrindKg, setRegrindKg] = useState('')
  const [insertId, setInsertId] = useState('')
  const [nutKg, setNutKg] = useState('')
  const [nutWtG, setNutWtG] = useState('')   // per-lot nut weight override (blank = use master)
  const [note, setNote] = useState('')

  const masterNutG = Number(byId(inserts, insertId)?.weightG) || 0
  const nutWeightG = Number(nutWtG) > 0 ? Number(nutWtG) : masterNutG
  const derivedNutQty = (Number(nutKg) > 0 && nutWeightG > 0) ? Math.round(Number(nutKg) * 1000 / nutWeightG) : 0

  const molderOpts = molders.map(m => ({ value: m.id, label: m.name }))
  const compoundOpts = compounds.map(c => ({ value: c.id, label: `${c.name} · ₹${c.rate}/kg` }))
  const nutOpts = [{ value: '', label: '— none —' }, ...inserts.map(i => ({ value: i.id, label: `${i.name} · ₹${i.rate}` }))]

  const bal = molderId
    ? molderBalance(molderId, { issues: issues.list, production: production.list, returns: returns.list, products: masters.products })
    : null

  const canSave = molderId && ((Number(compoundKg) || 0) > 0 || (Number(regrindKg) || 0) > 0 || (Number(nutKg) || 0) > 0)

  const save = () => {
    if (!canSave) { show('Enter a quantity returned', 2500); return }
    if (isLotFinalized(lotNo, lotLocks)) { show('🔒 That lot is finalized — reopen it first', 3000); return }
    if ((Number(compoundKg) || 0) < 0 || (Number(regrindKg) || 0) < 0 || (Number(nutKg) || 0) < 0) { show('Quantities cannot be negative', 3000); return }
    if (insertId && !(nutWeightG > 0)) { show("Set this nut's weight (g each) in Masters → Nuts first", 3500); return }
    if (insertId && nutWtG !== '' && !(Number(nutWtG) > 0)) { show('Enter a valid nut weight (g each), or leave it blank to use the standard', 3500); return }
    if (Number(nutWtG) > 100) { show('Nut weight looks too high (expected ~1–50 g each) — please check', 3500); return }
    if (insertId && !(Number(nutKg) > 0)) { show('⚖️ Nut weight (kg) is required when nuts come back', 3000); return }
    returns.insert({
      date, molderId, lotNo,
      compoundId, compoundKg: Number(compoundKg) || 0,
      regrindKg: Number(regrindKg) || 0,
      insertId, nutKg: Number(nutKg) || 0, nutQty: derivedNutQty, nutWeightG,
      note, voided: false, createdAt: new Date().toISOString(),
    })
    const m = byId(molders, molderId)
    log('RETURN', `${m?.name || molderId} · ${fmtNum(compoundKg) || 0}kg compound · ${fmtNum(regrindKg) || 0}kg regrind · ${fmtNum(nutKg) || 0}kg (${fmtNum(derivedNutQty)}) nuts`)
    show('✅ Material received back', 2000)
    setCompoundKg(''); setRegrindKg(''); setNutKg(''); setNutWtG(''); setNote('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <div className="bg-amber/10 border border-amber/30 rounded-xl px-4 py-3 text-sm text-amber">
        Record material the molder <b>hands back</b> (unused compound, loose regrind, leftover nuts).
        This reduces what's shown as “lying with the molder”.
      </div>

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
          <FieldLabel>Lot (which material this is from)</FieldLabel>
          <Select className="mt-1" value={lotNo} onChange={e => setLotNo(e.target.value)}
            options={[{ value: '', label: '— none —' }, ...lotsForMolder(molderId, { issues: issues.list }).map(l => ({ value: l, label: l }))]} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>Compound returned (unused)</FieldLabel>
        <Select options={compoundOpts} value={compoundId} onChange={e => setCompoundId(e.target.value)} />
        <div>
          <span className="text-xs text-muted">Compound weight (kg)</span>
          <NumberInput value={compoundKg} onChange={e => setCompoundKg(e.target.value)} placeholder="0" className="mt-1" />
        </div>
        <div>
          <span className="text-xs text-muted">Regrind / runner returned (kg)</span>
          <NumberInput value={regrindKg} onChange={e => setRegrindKg(e.target.value)} placeholder="0" className="mt-1" />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>Nuts received back (by weight)</FieldLabel>
        <Select options={nutOpts} value={insertId} onChange={e => setInsertId(e.target.value)} />
        {insertId && (
          <div>
            <span className="text-xs font-semibold text-signal-red">Nuts — weight (kg) · required when nuts come back *</span>
            <NumberInput value={nutKg} onChange={e => setNutKg(e.target.value)} placeholder="0" className="mt-1" />
            <div className="mt-2">
              <span className="text-xs text-muted">Nut weight this lot (g each) — change only if this batch differs</span>
              <NumberInput value={nutWtG} onChange={e => setNutWtG(e.target.value)} placeholder={masterNutG ? String(masterNutG) : '0'} className="mt-1" />
            </div>
            {derivedNutQty > 0 && (
              <div className="mt-1 bg-graphite border border-hairline text-chrome rounded-xl px-3 py-2 text-sm font-semibold">
                ≈ <b>{fmtNum(derivedNutQty)}</b> nuts (at {fmtNum(nutWeightG)} g each)
              </div>
            )}
          </div>
        )}
      </Card>

      {bal && (
        <Card className="p-4 !bg-graphite">
          <FieldLabel>Currently with this molder</FieldLabel>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">Compound balance</span>
            <span className="font-mono font-bold text-chrome">{fmtNum(bal.balanceKg)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Nuts balance</span>
            <span className="font-mono font-bold text-chrome">{fmtNum(bal.nutBalance)}</span>
          </div>
        </Card>
      )}

      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
        className="w-full border-2 border-hairline rounded-2xl px-4 py-3 text-base text-chrome bg-graphite placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber" rows={2} />

      <Button variant="success" size="lg" className="w-full" disabled={!canSave} onClick={save}>
        Record Return
      </Button>
    </div>
  )
}
