/**
 * Entries — a single chronological list of EVERYTHING entered: material issued,
 * production recorded, and material returned. This is the "did my entry save?"
 * screen. Owner can:
 *   • EDIT an entry in place (fix a wrong date or quantity) — change logged old→new.
 *     This replaces the old "void + re-enter" workaround that created duplicates.
 *   • Void an entry (soft-delete: kept in history, reason logged, never hard-deleted).
 *
 * Production pieces/rejects are NOT editable here on purpose: each production entry
 * carries a locked cost snapshot computed from its pieces, so changing pieces in
 * place would leave the cost stale. To change production pieces, void & re-enter.
 */
import { useMemo, useState } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel, Select, Button, DateInput, NumberInput } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { byId } from '../logic/costing'
import { isLotFinalized } from '../logic/lot'

const TYPE_META = {
  issue:      { label: 'Issued',     icon: '📦', color: 'bg-cyan-100 text-cyan-700' },
  production: { label: 'Production', icon: '➕', color: 'bg-emerald-100 text-emerald-700' },
  return:     { label: 'Returned',   icon: '↩️', color: 'bg-amber-100 text-amber-700' },
}

// Which numeric fields are editable per entry type (date is always editable).
const QTY_FIELDS = {
  issue:  [
    { name: 'compoundKg', label: 'Compound (kg)' },
    { name: 'mbKg',       label: 'Masterbatch (kg)' },
    { name: 'nutQty',     label: 'Nuts (pcs)' },
  ],
  return: [
    { name: 'compoundKg', label: 'Compound (kg)' },
    { name: 'regrindKg',  label: 'Regrind (kg)' },
    { name: 'nutQty',     label: 'Nuts (pcs)' },
  ],
  production: [], // date only — see file header
}

export default function Entries({ owner }) {
  const { production, issues, returns, molders, masters, log, lotLocks } = usePlastic()
  const [filter, setFilter] = useState('all')
  const [editRow, setEditRow] = useState(null) // the row being edited
  const [draft, setDraft] = useState({})

  const rows = useMemo(() => {
    const mName = (id) => byId(molders, id)?.name || '(molder)'
    const list = []

    for (const e of issues.list) {
      const bits = []
      if (Number(e.compoundKg) > 0) bits.push(`${fmtNum(e.compoundKg)} kg compound`)
      if (Number(e.mbKg) > 0) bits.push(`${fmtNum(e.mbKg)} kg MB`)
      if (Number(e.nutQty) > 0) bits.push(`${fmtNum(e.nutQty)} nuts`)
      list.push({ kind: 'issue', id: e.id, date: e.date, molder: mName(e.molderId),
        title: bits.join(' · ') || 'issue', voided: !!e.voided, ref: issues, raw: e })
    }
    for (const e of production.list) {
      const pcs = (e.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
      const names = (e.items || []).map(it => `${byId(masters.products, it.productId)?.name || 'product'} ${fmtNum(it.pieces)}`).join(', ')
      list.push({ kind: 'production', id: e.id, date: e.date, molder: mName(e.molderId),
        title: `${e.entryNo ? e.entryNo + ' · ' : ''}${names || fmtNum(pcs) + ' pcs'}`, voided: !!e.voided, ref: production, raw: e })
    }
    for (const e of returns.list) {
      const bits = []
      if (Number(e.compoundKg) > 0) bits.push(`${fmtNum(e.compoundKg)} kg compound`)
      if (Number(e.regrindKg) > 0) bits.push(`${fmtNum(e.regrindKg)} kg regrind`)
      if (Number(e.nutQty) > 0) bits.push(`${fmtNum(e.nutQty)} nuts`)
      list.push({ kind: 'return', id: e.id, date: e.date, molder: mName(e.molderId),
        title: bits.join(' · ') || 'return', voided: !!e.voided, ref: returns, raw: e })
    }

    list.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return (b.raw.createdAt || '').localeCompare(a.raw.createdAt || '')
    })
    return list
  }, [issues.list, production.list, returns.list, molders, masters.products])

  const shown = filter === 'all' ? rows : rows.filter(r => r.kind === filter)

  const voidEntry = (r) => {
    if (!owner || isLotFinalized(r.raw.lotNo, lotLocks)) return
    const reason = window.prompt(`Void this ${TYPE_META[r.kind].label} entry for ${r.molder}?\nType a reason:`)
    if (reason === null) return
    if (!reason.trim()) { window.alert('Reason required to void.'); return }
    r.ref.update(r.id, { voided: true, voidReason: reason.trim() })
    log('VOID', `${TYPE_META[r.kind].label} · ${r.molder} · ${r.title} · ${reason.trim()}`, owner ? 'owner' : 'user')
  }

  const openEdit = (r) => {
    if (isLotFinalized(r.raw.lotNo, lotLocks)) return
    const d = { date: r.date || '' }
    for (const f of QTY_FIELDS[r.kind]) d[f.name] = r.raw[f.name] ?? ''
    setDraft(d)
    setEditRow(r)
  }

  const saveEdit = () => {
    const r = editRow
    if (!r) return
    if (!draft.date) { window.alert('Date is required.'); return }
    const patch = { date: draft.date }
    const changes = []
    if (draft.date !== r.date) changes.push(`date ${fmtDate(r.date)}→${fmtDate(draft.date)}`)
    for (const f of QTY_FIELDS[r.kind]) {
      const next = Number(draft[f.name]) || 0
      const prev = Number(r.raw[f.name]) || 0
      patch[f.name] = next
      if (next !== prev) changes.push(`${f.label} ${fmtNum(prev)}→${fmtNum(next)}`)
    }
    if (changes.length === 0) { setEditRow(null); return } // nothing changed
    patch.editedAt = new Date().toISOString()
    r.ref.update(r.id, patch)
    log('EDIT', `${TYPE_META[r.kind].label} · ${r.molder} · ${changes.join(', ')}`, owner ? 'owner' : 'user')
    setEditRow(null)
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <Card className="p-3">
        <FieldLabel>Show</FieldLabel>
        <Select value={filter} onChange={e => setFilter(e.target.value)} className="mt-1"
          options={[
            { value: 'all', label: 'All entries' },
            { value: 'issue', label: 'Issued material' },
            { value: 'production', label: 'Production' },
            { value: 'return', label: 'Returned material' },
          ]} />
      </Card>

      {shown.length === 0 && (
        <Card className="p-6 text-center text-slate-400">No entries yet.</Card>
      )}

      {shown.map(r => {
        const t = TYPE_META[r.kind]
        const locked = isLotFinalized(r.raw.lotNo, lotLocks)
        return (
          <Card key={r.kind + r.id} className={`p-3 ${r.voided ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.color}`}>{t.icon} {t.label}</span>
                  <span className="text-xs text-slate-400">{fmtDate(r.date)}</span>
                  {r.raw.lotNo && <span className="text-[10px] text-slate-400">· {r.raw.lotNo}</span>}
                  {r.raw.editedAt && !r.voided && <span className="text-[10px] text-slate-400">(edited)</span>}
                  {r.voided && <span className="text-[10px] font-bold text-red-500">VOIDED</span>}
                </div>
                <div className={`font-semibold text-slate-700 text-sm mt-1 ${r.voided ? 'line-through' : ''}`}>{r.molder}</div>
                <div className="text-xs text-slate-500">{r.title}</div>
              </div>
              {owner && !r.voided && (
                locked ? (
                  <span className="shrink-0 text-xs font-semibold text-slate-400" title="Lot finalized — reopen it in Lot Report to edit">🔒 locked</span>
                ) : (
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button onClick={() => openEdit(r)}
                      className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5">Edit</button>
                    <button onClick={() => voidEntry(r)}
                      className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5">Void</button>
                  </div>
                )
              )}
            </div>
          </Card>
        )
      })}

      {editRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3"
          onClick={() => setEditRow(null)}>
          <Card className="p-4 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_META[editRow.kind].color}`}>
                {TYPE_META[editRow.kind].icon} {TYPE_META[editRow.kind].label}
              </span>
              <span className="font-semibold text-slate-700 text-sm">{editRow.molder}</span>
            </div>

            <div>
              <FieldLabel>Date</FieldLabel>
              <DateInput className="mt-1" value={draft.date}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
            </div>

            {QTY_FIELDS[editRow.kind].map(f => (
              <div key={f.name}>
                <FieldLabel>{f.label}</FieldLabel>
                <NumberInput className="mt-1" inputMode="decimal" value={draft[f.name]}
                  onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))} />
              </div>
            ))}

            {editRow.kind === 'production' && (
              <p className="text-xs text-slate-500">
                To change pieces or rejects, void this entry and re-enter it — that keeps the cost accurate.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveEdit}>Save changes</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
