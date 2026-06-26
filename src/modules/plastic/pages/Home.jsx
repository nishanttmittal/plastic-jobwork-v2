/**
 * Home — the morning glance (owner). Alerts, what's still out with molders to
 * collect (per OPEN lot — finalized/settled lots drop off), money, then output.
 */
import { useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card } from '../../../core/ui'
import { todayStr, fmtNum } from '../../../core/utils/format'
import { molderHisab } from '../logic/hisab'
import { materialStock } from '../logic/stock'
import { lotList, lotReconciliation, isLotFinalized } from '../logic/lot'

export default function Home({ owner, onOpen }) {
  const { production, issues, returns, purchases, payments, masters, lotLocks } = usePlastic()
  const data = useMemo(() => ({ issues: issues.list, production: production.list, returns: returns.list }),
    [issues.list, production.list, returns.list])

  // Only NEGATIVE stock is a real alert (issued/used more than bought). Stock at
  // ~0 is normal here — material is sent straight to the moulder, not stored.
  const shortStock = useMemo(
    () => (owner ? materialStock(masters, { purchases: purchases.list, issues: issues.list, returns: returns.list }).all.filter(i => i.stock < 0) : []),
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
  }), { pieces: 0, nuts: 0, kg: 0 })
  const alerts = openLots.filter(r => r.flag)

  const money = useMemo(() => {
    if (!owner) return null
    const ids = [...new Set(production.list.filter(e => !e.voided).map(e => e.molderId))]
    return ids.reduce((s, id) => s + molderHisab(id, masters, { production: production.list, payments: payments.list }).balance, 0)
  }, [owner, masters, production.list, payments.list])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {alerts.length > 0 && (
        <button onClick={() => onOpen && onOpen('moulders')} className="w-full text-left">
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="font-bold text-red-700">🚩 {alerts.length} material alert{alerts.length > 1 ? 's' : ''}</div>
            <div className="text-sm text-red-600 mt-1">{alerts.map(a => a.lotNo).join(', ')} — used more material than was sent. Tap to check.</div>
          </Card>
        </button>
      )}

      {owner && shortStock.length > 0 && (
        <button onClick={() => onOpen && onOpen('stock')} className="w-full text-left">
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="font-bold text-amber-700">📦 Stock shortfall — buy / record purchase</div>
            <div className="text-sm text-amber-700 mt-1">{shortStock.map(i => `${i.name}: ${fmtNum(i.stock)} ${i.unit}`).join(' · ')}</div>
          </Card>
        </button>
      )}

      {/* To collect — per open lot (tap for full detail) */}
      <button onClick={() => onOpen && onOpen('moulders')} className="w-full text-left">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase">Still out with moulders</div>
            <span className="text-slate-300">›</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Tile n={fmtNum(collect.pieces)} l="pieces pending" />
            <Tile n={fmtNum(collect.nuts)} l="loose nuts" />
            <Tile n={`${fmtNum(collect.kg)} kg`} l="material" />
          </div>
          {openLots.length > 0 ? (
            <div className="mt-3 border-t pt-2 space-y-1.5">
              {openLots.map(r => (
                <div key={r.lotNo} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-600">{r.lotNo} <span className="font-normal text-slate-400">· {r.molder?.name || ''}</span></span>
                  <span className="text-xs text-slate-500 font-mono">
                    {r.pendingPieces > 0 ? `${fmtNum(r.pendingPieces)} pcs · ` : ''}{r.nutBalance > 0 ? `${fmtNum(r.nutBalance)} nuts · ` : ''}{r.balanceKg > 0.5 ? `${fmtNum(r.balanceKg)} kg` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="mt-3 border-t pt-2 text-sm text-slate-400">Nothing pending — all lots delivered or finalized.</div>}
        </Card>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center"><div className="text-3xl font-bold text-teal-700">{fmtNum(piecesToday)}</div><div className="text-xs text-slate-500 mt-1">Pieces today</div></Card>
        <Card className="p-4 text-center"><div className="text-3xl font-bold text-slate-700">{fmtNum(monthPieces)}</div><div className="text-xs text-slate-500 mt-1">Pieces this month</div></Card>
      </div>

      {owner && money != null && (
        <button onClick={() => onOpen && onOpen('moulders')} className="w-full text-left">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">{money >= 0 ? 'You owe moulders' : 'Moulders owe you'}</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">₹{fmtNum(Math.abs(money))}</div>
            </div>
            <span className="text-slate-300 text-xl">›</span>
          </Card>
        </button>
      )}

      <p className="text-center text-xs text-slate-400">Per-lot detail & PDF under More → Lot Report.</p>
    </div>
  )
}

function Tile({ n, l }) {
  return (
    <div className="bg-slate-50 rounded-xl py-3">
      <div className="text-lg font-bold text-slate-800">{n}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{l}</div>
    </div>
  )
}
