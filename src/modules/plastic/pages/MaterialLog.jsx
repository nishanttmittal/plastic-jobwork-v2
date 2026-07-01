/**
 * Material — last 15 days. Read-only view for the MANAGER (and owner): what
 * material was SENT to moulders and what was RECEIVED back, over the last 15
 * days. No money/cost — pure material movement.
 */
import { useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel } from '../../../core/ui'
import { fmtDate, fmtNum, fmtPcsKg, fmtCountKg } from '../../../core/utils/format'
import { byId } from '../logic/costing'

const sinceStr = () => new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10)
const num = (n) => Number(n) || 0

export default function MaterialLog() {
  const { issues, production, returns, molders, masters } = usePlastic()
  const since = sinceStr()
  const mName = (id) => byId(molders, id)?.name || '(moulder)'
  const pName = (id) => byId(masters.products, id)?.name || 'product'
  // nuts show the actual weighed kg stored on the entry (nut size differs lot to
  // lot); fall back to master weight × count for old entries.
  const nutKgOf = (e) => Number(e.nutKg) > 0 ? Number(e.nutKg)
    : (Number(e.nutQty) || 0) * (byId(masters.inserts, e.insertId)?.weightG || masters.inserts?.[0]?.weightG || 0) / 1000
  const pieceG = (id) => byId(masters.products, id)?.finishedPieceG || 0

  const { sent, received } = useMemo(() => {
    const act = (rows) => (rows || []).filter(r => !r.voided && (r.date || '') >= since)
    const sent = act(issues.list).map(i => {
      const bits = []
      if (num(i.compoundKg) > 0) bits.push(`${fmtNum(i.compoundKg)} kg compound`)
      if (num(i.mbKg) > 0) bits.push(`${fmtNum(i.mbKg)} kg MB`)
      if (num(i.nutKg) > 0 || num(i.nutQty) > 0) bits.push(`${fmtCountKg(i.nutQty, nutKgOf(i))} nuts`)
      return { id: i.id, date: i.date, molder: mName(i.molderId), lot: i.lotNo || '', text: bits.join(' · ') || 'issue' }
    }).sort((a, b) => (a.date < b.date ? 1 : -1))

    const received = []
    for (const p of act(production.list)) {
      const pcs = (p.items || []).reduce((s, it) => s + num(it.pieces), 0)
      const names = (p.items || []).map(it => `${fmtPcsKg(it.pieces, pieceG(it.productId))} ${pName(it.productId)}`).join(', ')
      received.push({ id: p.id, date: p.date, molder: mName(p.molderId), lot: p.lotNo || '',
        text: `${names || fmtNum(pcs) + ' pcs'}${num(p.finishedKg) > 0 ? ` · ${fmtNum(p.finishedKg)} kg` : ''}`, kind: 'goods' })
    }
    for (const r of act(returns.list)) {
      const bits = []
      if (num(r.compoundKg) > 0) bits.push(`${fmtNum(r.compoundKg)} kg compound`)
      if (num(r.regrindKg) > 0) bits.push(`${fmtNum(r.regrindKg)} kg regrind`)
      if (num(r.nutKg) > 0 || num(r.nutQty) > 0) bits.push(`${fmtCountKg(r.nutQty, nutKgOf(r))} nuts`)
      received.push({ id: r.id, date: r.date, molder: mName(r.molderId), lot: r.lotNo || '',
        text: bits.join(' · ') || 'return', kind: 'back' })
    }
    received.sort((a, b) => (a.date < b.date ? 1 : -1))
    return { sent, received }
  }, [issues.list, production.list, returns.list, molders, masters.products, since])

  const Row = ({ r }) => (
    <div className="flex items-start justify-between gap-2 text-sm border-b border-hairline py-1.5 last:border-0">
      <div className="min-w-0">
        <div className="text-chrome">{r.text}</div>
        <div className="text-xs text-muted">{r.molder}{r.lot ? ` · ${r.lot}` : ''}</div>
      </div>
      <div className="text-xs text-muted shrink-0">{fmtDate(r.date)}</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <Card className="p-4">
        <FieldLabel>📤 Sent to moulder — last 15 days ({sent.length})</FieldLabel>
        <div className="mt-2">{sent.length ? sent.map(r => <Row key={r.id} r={r} />) : <div className="text-sm text-muted py-2">Nothing sent in 15 days.</div>}</div>
      </Card>
      <Card className="p-4">
        <FieldLabel>📥 Received from moulder — last 15 days ({received.length})</FieldLabel>
        <div className="mt-2">{received.length ? received.map(r => <Row key={r.id} r={r} />) : <div className="text-sm text-muted py-2">Nothing received in 15 days.</div>}</div>
      </Card>
    </div>
  )
}
