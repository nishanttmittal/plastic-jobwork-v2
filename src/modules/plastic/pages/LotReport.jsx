/**
 * Lot Report — pick a raw-material lot and see the full "sent vs received"
 * reconciliation + the true cost per piece (two ways), exportable as a PDF
 * you can share on WhatsApp. Owner-only (shows rates/money).
 */
import { useMemo, useState } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel, Select, Button } from '../../../core/ui'
import { fmtDate, fmtNum, fmtPcsKg, fmtCountKg } from '../../../core/utils/format'
import { lotList, lotReconciliation, isLotFinalized } from '../logic/lot'
import { jobWorkTotal, byId } from '../logic/costing'
import { buildLotPdf } from '../logic/lotPdf'
import { ADMIN_PASSWORD, rejectReasonLabel } from '../config'

export default function LotReport() {
  const { masters, issues, production, returns, lotLocks, setLotLocks, log } = usePlastic()
  const data = useMemo(() => ({ issues: issues.list, production: production.list, returns: returns.list }),
    [issues.list, production.list, returns.list])

  const lots = useMemo(() => lotList(data), [data])
  const [lotNo, setLotNo] = useState(lots[0]?.lotNo || '')
  const r = useMemo(() => (lotNo ? lotReconciliation(lotNo, masters, data) : null), [lotNo, masters, data])

  // Reject reasons for THIS lot (QC). Handles both record shapes: new entries
  // carry rejectRows [{reason,qty}]; old ones a single rejectReason + rejects.
  // (Folded in from the removed 15-day Report — here it's per-lot, more useful.)
  const rejReasons = useMemo(() => {
    const byReason = {}
    for (const e of production.list.filter(p => !p.voided && (p.lotNo || '') === lotNo)) {
      for (const it of e.items || []) {
        const rows = Array.isArray(it.rejectRows) && it.rejectRows.length
          ? it.rejectRows : [{ reason: it.rejectReason || '', qty: Number(it.rejects) || 0 }]
        for (const row of rows) {
          const q = Number(row.qty) || 0
          if (q > 0) byReason[row.reason || ''] = (byReason[row.reason || ''] || 0) + q
        }
      }
    }
    return Object.entries(byReason).sort((a, b) => b[1] - a[1])
  }, [production.list, lotNo])

  const exportPdf = async () => (await buildLotPdf(lotNo, masters, data)).save(`Lot-${lotNo}.pdf`)

  const finalized = isLotFinalized(lotNo, lotLocks)
  const finalize = () => {
    if (window.prompt('Finalize (lock) this lot? Entries can no longer be edited and the pay is frozen.\nAdmin password:') !== ADMIN_PASSWORD) {
      window.alert('Wrong password.'); return
    }
    // Freeze pay on every production entry in this lot so a later rate change
    // can't alter the settled dues.
    production.list.filter(p => (p.lotNo || '') === lotNo && !p.voided).forEach(e => {
      production.update(e.id, { locked: true, lockedJobWork: jobWorkTotal(e, byId(masters.molders, e.molderId)) })
    })
    setLotLocks([...(lotLocks || []), { lotNo, finalizedAt: new Date().toISOString(), by: 'owner' }])
    log('LOT_FINALIZE', `${lotNo} finalized (locked, pay frozen)`, 'owner')
  }
  const reopen = () => {
    if (window.prompt('Reopen this lot for editing?\nAdmin password:') !== ADMIN_PASSWORD) {
      window.alert('Wrong password.'); return
    }
    production.list.filter(p => (p.lotNo || '') === lotNo).forEach(e => {
      if (e.locked) production.update(e.id, { locked: false, lockedJobWork: 0 })
    })
    setLotLocks((lotLocks || []).filter(l => l.lotNo !== lotNo))
    log('LOT_REOPEN', `${lotNo} reopened`, 'owner')
  }

  if (lots.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card className="p-6 text-center text-muted space-y-2">
          <div className="text-3xl">📦</div>
          <div className="font-semibold text-chrome">No lots yet</div>
          <div className="text-sm">Tag a <b>Lot</b> when you issue material (Record → Issue), then record the
            pieces and scrap against the same lot. The reconciliation builds itself here.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <Card className="p-3">
        <FieldLabel>Lot</FieldLabel>
        <Select className="mt-1" value={lotNo} onChange={e => setLotNo(e.target.value)}
          options={lots.map(l => ({ value: l.lotNo, label: `${l.lotNo} · ${l.molderId ? '' : ''}${fmtDate(l.firstDate)}` }))} />
        {r?.molder && <div className="text-xs text-muted mt-1">Molder: {r.molder.name}</div>}
      </Card>

      {r && (
        <>
          <Card className="p-4 space-y-2">
            <FieldLabel>📤 Raw material sent</FieldLabel>
            <Row label="Compound (PP)" val={`${fmtNum(r.sent.compoundKg)} kg`} sub={`@ ₹${fmtNum(r.sent.cmpRate)}/kg`} />
            {r.sent.nutsSent > 0 && <Row label="Nuts" val={fmtCountKg(r.sent.nutsSent, r.nutsSentKg)} sub={`@ ₹${fmtNum(r.sent.nutRate)}`} />}
            {r.sent.mbKg > 0 && <Row label="Masterbatch" val={`${fmtNum(r.sent.mbKg)} kg`} />}
          </Card>

          <Card className="p-4 space-y-2">
            <FieldLabel>📥 Received back</FieldLabel>
            {r.received.machineShots > 0 && (
              <div className={`text-sm rounded-xl px-3 py-2 ${Math.abs(r.received.machinePieces - (r.received.goodPieces + r.received.rejectPieces)) > Math.max(5, r.received.machinePieces * 0.02) ? 'bg-amber/10 text-amber' : 'bg-signal-green/10 text-signal-green'}`}>
                🏭 Machine: {fmtNum(r.received.machineShots)} shots → <b>{fmtNum(r.received.machinePieces)}</b> pcs vs {fmtNum(r.received.goodPieces + r.received.rejectPieces)} counted
              </div>
            )}
            <Row label="Good pieces" val={fmtPcsKg(r.received.goodPieces, r.pieceG)} strong />
            <Row label="Reject pieces" val={fmtPcsKg(r.received.rejectPieces, r.pieceG)} />
            {r.received.rejectPieces > 0 && (() => {
              const total = r.received.goodPieces + r.received.rejectPieces
              const pct = total > 0 ? (r.received.rejectPieces / total) * 100 : 0
              return (
                <div className={`text-sm rounded-xl px-3 py-2 ${pct >= 5 ? 'bg-signal-red/10 text-signal-red' : pct >= 2 ? 'bg-amber/10 text-amber' : 'bg-graphite text-muted'}`}>
                  <div className="font-semibold">Rejections: {pct.toFixed(1)}% ({fmtNum(r.received.rejectPieces)} of {fmtNum(total)})</div>
                  {rejReasons.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {rejReasons.map(([key, qty]) => (
                        <div key={key || 'none'} className="flex justify-between text-xs"><span>{rejectReasonLabel(key)}</span><span className="font-mono">{fmtNum(qty)}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
            <Row label="Runner returned" val={`${fmtNum(r.received.runnerKg)} kg`} />
            <Row label="Rejects returned" val={`${fmtNum(r.received.rejectsKg)} kg`} />
            <Row label="Burnt / purge loss" val={`${fmtNum(r.received.burntKg)} kg`} />
            <Row label="Loose nuts returned" val={fmtCountKg(r.returned.nuts, r.returnedNutsKg)} />
            <Row label="Finished weight (weighed)" val={`${fmtNum(r.received.finishedKg)} kg`} />
            {r.efficiency && (
              <div className={`text-sm rounded-xl px-3 py-2 mt-1 ${r.efficiency.pct != null && r.efficiency.pct < 85 ? 'bg-amber/10 text-amber' : 'bg-graphite text-muted'}`}>
                ⚙️ {fmtNum(r.efficiency.actualPerHr)} shots/hr{r.efficiency.targetPerHr > 0 && ` (target ${fmtNum(r.efficiency.targetPerHr)})`}
                {r.efficiency.pct != null && ` — ${fmtNum(r.efficiency.pct)}% efficiency`}
                {r.efficiency.pct != null && r.efficiency.pct < 85 && ` · ~${fmtNum(r.efficiency.idleHours)} hr idle 🐢`}
              </div>
            )}
          </Card>

          <Card className={`p-4 space-y-2 ${r.flag ? '!bg-signal-red/10 !border-signal-red/30' : '!bg-graphite'}`}>
            <FieldLabel>⚖️ Material balance</FieldLabel>
            <Row label="Compound sent" val={`${fmtNum(r.sent.compoundKg)} kg`} />
            <Row label="Accounted" val={`${fmtNum(r.accountedKg)} kg`} />
            <Row label="Unaccounted / with molder" val={`${fmtNum(r.balanceKg)} kg`} strong />
            <Row label="Material loss" val={`${fmtNum(r.lossPct)} %`} />
            <Row label="Recoverable regrind" val={`${fmtNum(r.regrindKg)} kg`} />
            <Row label="Nut balance" val={fmtCountKg(r.nutBalance, r.nutBalanceKg)} />
            {r.flag && <div className="text-xs font-semibold text-signal-red">🚩 More plastic came out than was sent — re-check weights/pieces.</div>}
          </Card>

          <Card className="p-4 !bg-graphite border border-amber/30 space-y-3">
            <FieldLabel className="text-amber">🏷️ Cost per piece (both incl. nut + job-work)</FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <RateBox title="Scrap = full loss" val={r.rates.fullLoss} note="all compound charged" />
              <RateBox title="Regrind reused" val={r.rates.regrind} note="regrind credited back" />
            </div>
            <div className="text-xs text-muted border-t border-hairline pt-2 space-y-0.5">
              <div className="flex justify-between"><span>Compound / piece</span><span className="font-mono text-chrome">₹{rupee2(r.rates.compoundFullLoss)} → ₹{rupee2(r.rates.compoundNet)}</span></div>
              {r.rates.nutPerPiece > 0 && <div className="flex justify-between"><span>Nut / piece</span><span className="font-mono text-chrome">₹{rupee2(r.rates.nutPerPiece)}</span></div>}
              <div className="flex justify-between"><span>Job-work / piece</span><span className="font-mono text-chrome">₹{rupee2(r.rates.jobWorkPerPiece)}</span></div>
            </div>
          </Card>

          <Button size="lg" className="w-full" onClick={exportPdf}>📄 Export PDF (share on WhatsApp)</Button>

          {finalized ? (
            <div className="bg-graphite border border-hairline rounded-2xl p-3 text-center space-y-2">
              <div className="text-sm font-semibold text-chrome">🔒 Lot finalized — entries are locked</div>
              <Button variant="ghost" className="w-full" onClick={reopen}>Reopen for editing</Button>
            </div>
          ) : (
            <Button variant="ghost" className="w-full" onClick={finalize}>🔒 Finalize hisab (lock this lot)</Button>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, val, sub, strong }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}{sub && <span className="text-muted/70"> · {sub}</span>}</span>
      <span className={`font-mono ${strong ? 'font-bold text-chrome' : 'text-chrome'}`}>{val}</span>
    </div>
  )
}

// Per-piece costs are small — show paise (₹6.17), unlike fmtNum which rounds to
// whole rupees (fine for counts/kg, but it turned ₹1.50 nut into "₹2").
const rupee2 = (n) => (Number(n) || 0).toFixed(2)

function RateBox({ title, val, note }) {
  return (
    <div className="bg-steel rounded-xl p-3 text-center border border-amber/20">
      <div className="font-mono tnum text-2xl font-bold text-amber">₹{rupee2(val)}</div>
      <div className="text-[11px] font-semibold text-chrome mt-0.5">{title}</div>
      <div className="text-[10px] text-muted">{note}</div>
    </div>
  )
}
