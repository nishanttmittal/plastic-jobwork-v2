/**
 * QC / Reports — production reporting that ISN'T shown elsewhere:
 *   • Rejections (last 15 days) with % badge and breakdown by reason (QC)
 *   • Raw material in/out (last 15 days)
 *   • Final product made (last 15 days)
 *
 * Deliberately does NOT repeat Home (pieces today/month), Jobs (moulder
 * balances / money) or Machine Load (buy-the-machine) — each lives in one place.
 */
import { useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel } from '../../../core/ui'
import { daysAgoStr, fmtNum, fmtPcsKg } from '../../../core/utils/format'
import { rejectReasonLabel } from '../config'

export default function Dashboard() {
  const { production, issues, returns, products, masters } = usePlastic()
  const nutG = masters?.inserts?.[0]?.weightG || 0  // nut weight for "nuts (kg)" display

  // Last 15 days — raw material in/out and final product (pieces only).
  const since15 = daysAgoStr(15)
  const last15 = useMemo(() => {
    const iss = issues.list.filter(i => !i.voided && i.date >= since15)
    const prod = production.list.filter(e => !e.voided && e.date >= since15)
    const ret = returns.list.filter(r => !r.voided && r.date >= since15)
    const rawOut = {
      compoundKg: iss.reduce((s, i) => s + (Number(i.compoundKg) || 0), 0),
      mbKg: iss.reduce((s, i) => s + (Number(i.mbKg) || 0), 0),
      nuts: iss.reduce((s, i) => s + (Number(i.nutQty) || 0), 0),
    }
    const rawIn = {
      regrindKg: prod.reduce((s, e) => s + (Number(e.runnerKg) || 0) + (Number(e.rejectsKg) || 0), 0),
      burntKg: prod.reduce((s, e) => s + (Number(e.burntKg) || 0), 0),
      returnedKg: ret.reduce((s, r) => s + (Number(r.compoundKg) || 0) + (Number(r.regrindKg) || 0), 0),
      returnedNuts: ret.reduce((s, r) => s + (Number(r.nutQty) || 0), 0),
    }
    const prodMap = {}
    for (const e of prod) for (const it of (e.items || [])) {
      prodMap[it.productId] = (prodMap[it.productId] || 0) + (Number(it.pieces) || 0)
    }
    return { rawOut, rawIn, prodMap }
  }, [issues.list, production.list, returns.list, since15])

  // Rejections — last 15 days: total good vs reject pieces, rejection %, and a
  // breakdown by reason (QC). Pieces only — no money.
  const rejects15 = useMemo(() => {
    const prod = production.list.filter(e => !e.voided && e.date >= since15)
    let good = 0, rej = 0
    const byReason = {}
    for (const e of prod) for (const it of (e.items || [])) {
      good += Number(it.pieces) || 0
      // New records carry rejectRows [{reason, qty}]; old records have a single
      // rejectReason + total rejects. Normalise both into reason rows.
      const rows = Array.isArray(it.rejectRows) && it.rejectRows.length
        ? it.rejectRows
        : [{ reason: it.rejectReason || '', qty: Number(it.rejects) || 0 }]
      for (const row of rows) {
        const q = Number(row.qty) || 0
        if (q > 0) {
          rej += q
          const key = row.reason || ''
          byReason[key] = (byReason[key] || 0) + q
        }
      }
    }
    const total = good + rej
    const pct = total > 0 ? (rej / total) * 100 : 0
    const reasons = Object.entries(byReason).sort((a, b) => b[1] - a[1])
    return { good, rej, total, pct, reasons }
  }, [production.list, since15])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Rejections — last 15 days (QC) */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <FieldLabel>Rejections — last 15 days</FieldLabel>
          {rejects15.total > 0 && (
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
              rejects15.pct >= 5 ? 'bg-signal-red/15 text-signal-red'
                : rejects15.pct >= 2 ? 'bg-amber/15 text-amber'
                : 'bg-signal-green/15 text-signal-green'}`}>
              {rejects15.pct.toFixed(1)}%
            </span>
          )}
        </div>
        {rejects15.total === 0 ? (
          <p className="text-muted text-sm mt-2">No production in the last 15 days.</p>
        ) : rejects15.rej === 0 ? (
          <p className="text-signal-green text-sm mt-2 font-semibold">✅ Zero rejects on {fmtNum(rejects15.good)} pieces.</p>
        ) : (
          <div className="mt-2 text-sm space-y-1">
            <Row label="Reject pieces" val={`${fmtNum(rejects15.rej)} of ${fmtNum(rejects15.total)}`} />
            <div className="text-xs font-bold text-muted uppercase mt-2">By reason</div>
            {rejects15.reasons.map(([key, qty]) => (
              <Row key={key || 'none'} label={rejectReasonLabel(key)} val={fmtNum(qty)} />
            ))}
          </div>
        )}
      </Card>

      {/* Last 15 days — RAW MATERIAL (in/out) */}
      <Card className="p-4">
        <FieldLabel>Raw material — last 15 days</FieldLabel>
        <div className="mt-2 text-sm space-y-1">
          <div className="text-xs font-bold text-muted uppercase mt-1">Sent to molders (OUT)</div>
          <Row label="Compound" val={`${fmtNum(last15.rawOut.compoundKg)} kg`} />
          <Row label="Masterbatch" val={`${fmtNum(last15.rawOut.mbKg)} kg`} />
          <Row label="Nuts" val={fmtPcsKg(last15.rawOut.nuts, nutG)} />
          <div className="text-xs font-bold text-muted uppercase mt-2">Returned (IN)</div>
          <Row label="Regrind (runner + rejects)" val={`${fmtNum(last15.rawIn.regrindKg)} kg`} />
          <Row label="Burnt loss" val={`${fmtNum(last15.rawIn.burntKg)} kg`} />
          <Row label="Returned by molder (compound + regrind)" val={`${fmtNum(last15.rawIn.returnedKg)} kg`} />
          <Row label="Nuts returned" val={fmtPcsKg(last15.rawIn.returnedNuts, nutG)} />
        </div>
      </Card>

      {/* Last 15 days — FINAL PRODUCT */}
      <Card className="p-4">
        <FieldLabel>Final product — last 15 days</FieldLabel>
        <div className="mt-2 text-sm space-y-1">
          {Object.keys(last15.prodMap).length === 0 && <p className="text-muted">No production in the last 15 days.</p>}
          {products.filter(p => last15.prodMap[p.id]).map(p => (
            <Row key={p.id} label={p.name} val={`${fmtPcsKg(last15.prodMap[p.id], p.finishedPieceG)} pcs`} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function Row({ label, val }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-chrome">{val}</span>
    </div>
  )
}
