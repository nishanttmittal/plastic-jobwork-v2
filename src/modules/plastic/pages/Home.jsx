/**
 * Home — the morning glance (owner), Machined Instrument style. Alerts, what's
 * still out with moulders (per OPEN lot — finalized lots drop off), output, and
 * money. Computations reuse the tested logic unchanged; only the look is new.
 */
import { useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { InstrumentCard, Readout, StatusPip } from '../../../core/ui'
import { todayStr, fmtNum, fmtPcsKg } from '../../../core/utils/format'
import { molderHisab } from '../logic/hisab'
import { materialStock } from '../logic/stock'
import { lotList, lotReconciliation, isLotFinalized } from '../logic/lot'

export default function Home({ owner, onOpen }) {
  const { production, issues, returns, purchases, payments, masters, lotLocks } = usePlastic()
  const data = useMemo(() => ({ issues: issues.list, production: production.list, returns: returns.list }),
    [issues.list, production.list, returns.list])

  // Only NEGATIVE stock is a real alert (issued/used more than bought). Stock at
  // ~0 is normal here — material is sent straight to the moulder, not stored.
  // GUARD: only trust this once purchases have actually loaded. On the shared
  // free-tier Firestore, reads can die mid-session and the purchases query comes
  // back empty — which would make every issued material look negative and raise
  // a FALSE "shortfall". If no purchases are loaded, suppress the alarm.
  const shortStock = useMemo(
    () => (owner && purchases.list.length > 0
      ? materialStock(masters, { purchases: purchases.list, issues: issues.list, returns: returns.list }).all.filter(i => i.stock < 0)
      : []),
    [owner, masters, purchases.list, issues.list, returns.list],
  )

  const today = todayStr()
  const piecesToday = useMemo(() => production.list.filter(e => e.date === today && !e.voided)
    .reduce((s, e) => s + (e.items || []).reduce((a, it) => a + (Number(it.pieces) || 0), 0), 0), [production.list, today])
  const mth = new Date().getMonth(), yr = new Date().getFullYear()
  const monthPieces = useMemo(() => production.list
    .filter(e => { const d = new Date(e.date); return d.getMonth() === mth && d.getFullYear() === yr && !e.voided })
    .reduce((s, e) => s + (e.items || []).reduce((a, it) => a + (Number(it.pieces) || 0), 0), 0), [production.list, mth, yr])

  // Per OPEN lot (finalized lots are settled → excluded from "to collect").
  const openLots = useMemo(() => lotList(data)
    .filter(l => !isLotFinalized(l.lotNo, lotLocks))
    .map(l => lotReconciliation(l.lotNo, masters, data))
    .filter(r => (r.pendingPieces > 0) || (r.nutBalance > 0) || (r.balanceKg > 0.5) || r.flag),
  [data, masters, lotLocks])

  const collect = openLots.reduce((a, r) => ({
    pieces: a.pieces + Math.max(0, r.pendingPieces || 0),
    nuts: a.nuts + Math.max(0, r.nutBalance || 0),
    kg: Math.round((a.kg + Math.max(0, r.balanceKg || 0)) * 10) / 10,
    // weight equivalents for the "pieces (kg)" rule (owner 2026-07-01)
    pcsKg: a.pcsKg + (Math.max(0, r.pendingPieces || 0) * (r.pieceG || 0)) / 1000,
    nutsKg: a.nutsKg + (Math.max(0, r.nutBalance || 0) * (r.nutWeightG || 0)) / 1000,
  }), { pieces: 0, nuts: 0, kg: 0, pcsKg: 0, nutsKg: 0 })
  const alerts = openLots.filter(r => r.flag)

  const money = useMemo(() => {
    if (!owner) return null
    const ids = [...new Set(production.list.filter(e => !e.voided).map(e => e.molderId))]
    return ids.reduce((s, id) => s + molderHisab(id, masters, { production: production.list, payments: payments.list }).balance, 0)
  }, [owner, masters, production.list, payments.list])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      {alerts.length > 0 && (
        <button onClick={() => onOpen && onOpen('jobs')} className="w-full text-left">
          <InstrumentCard className="p-4 !bg-signal-red/10 !border-signal-red/40">
            <div className="flex items-center gap-2">
              <StatusPip tone="red" />
              <span className="font-display font-bold text-signal-red">{alerts.length} material alert{alerts.length > 1 ? 's' : ''}</span>
            </div>
            <div className="text-sm text-signal-red/80 mt-1">{alerts.map(a => a.lotNo).join(', ')} — more material came out than was sent. Tap to check.</div>
          </InstrumentCard>
        </button>
      )}

      {owner && shortStock.length > 0 && (
        <button onClick={() => onOpen && onOpen('stock')} className="w-full text-left">
          <InstrumentCard className="p-4 !bg-amber/10 !border-amber/40">
            <div className="flex items-center gap-2">
              <StatusPip tone="amber" />
              <span className="font-display font-bold text-amber">Stock shortfall — record a purchase</span>
            </div>
            <div className="text-sm text-amber/80 mt-1">{shortStock.map(i => `${i.name}: ${fmtNum(i.stock)} ${i.unit}`).join(' · ')}</div>
          </InstrumentCard>
        </button>
      )}

      {/* Still out with moulders — per open lot */}
      <button onClick={() => onOpen && onOpen('jobs')} className="w-full text-left">
        <InstrumentCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Out with moulders</span>
            <span className="text-muted">›</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Readout value={fmtNum(collect.pieces)} label={collect.pcsKg > 0 ? `pcs · ${fmtNum(collect.pcsKg)} kg` : 'pieces'} />
            <Readout value={fmtNum(collect.nuts)} label={collect.nutsKg > 0 ? `nuts · ${fmtNum(collect.nutsKg)} kg` : 'nuts'} />
            <Readout value={fmtNum(collect.kg)} label="kg" />
          </div>
          {openLots.length > 0 ? (
            <div className="mt-3 border-t border-hairline pt-2 space-y-1.5">
              {openLots.map(r => (
                <div key={r.lotNo} className="flex items-center justify-between text-sm gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <StatusPip tone={r.flag ? 'red' : 'amber'} />
                    <span className="font-semibold text-chrome shrink-0">{r.lotNo}</span>
                    <span className="text-muted truncate">{[r.compoundName, r.molder?.name].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="font-mono tnum text-xs text-muted shrink-0 text-right">
                    {r.pendingPieces > 0 ? `${fmtPcsKg(r.pendingPieces, r.pieceG)} pcs · ` : ''}{r.nutBalance > 0 ? `${fmtPcsKg(r.nutBalance, r.nutWeightG)} nuts · ` : ''}{r.balanceKg > 0.5 ? `${fmtNum(r.balanceKg)} kg` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="mt-3 border-t border-hairline pt-2 text-sm text-muted">Nothing pending — all lots delivered or finalized.</div>}
        </InstrumentCard>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <InstrumentCard className="p-4"><Readout value={fmtNum(piecesToday)} label="pieces today" tone="green" /></InstrumentCard>
        <InstrumentCard className="p-4"><Readout value={fmtNum(monthPieces)} label="pieces this month" /></InstrumentCard>
      </div>

      {owner && money != null && (
        <button onClick={() => onOpen && onOpen('jobs')} className="w-full text-left">
          <InstrumentCard className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{money >= 0 ? 'You owe moulders' : 'Moulders owe you'}</div>
              <div className={`font-mono tnum text-2xl font-bold mt-1 ${money >= 0 ? 'text-amber' : 'text-signal-green'}`}>₹{fmtNum(Math.abs(money))}</div>
            </div>
            <span className="text-muted text-xl">›</span>
          </InstrumentCard>
        </button>
      )}

      <p className="text-center text-[11px] text-muted">Per-lot detail & PDF under Jobs.</p>
    </div>
  )
}
