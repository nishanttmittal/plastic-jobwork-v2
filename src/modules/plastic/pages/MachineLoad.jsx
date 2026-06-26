/**
 * Machine Load / Buy-Signal — should I buy my own moulding machine yet?
 * Owner-only. Uses the real machine-shots + hours captured on production to
 * show how full one machine would be, and the in-house vs outsource verdict.
 */
import { useMemo, useState } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel, Select } from '../../../core/ui'
import { fmtNum } from '../../../core/utils/format'
import { machineLoad } from '../logic/machineLoad'

const VERDICT = {
  buy:            { label: '✅ BUY — volume justifies a machine', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  'getting-close':{ label: '🟡 GETTING CLOSE — keep watching', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
  outsource:      { label: '⏸️ KEEP OUTSOURCING', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  nodata:         { label: 'ℹ️ Not enough data yet', cls: 'bg-slate-50 border-slate-200 text-slate-500' },
}

export default function MachineLoad() {
  const { masters, production, issues, returns } = usePlastic()
  const [days, setDays] = useState(30)
  const data = useMemo(() => ({ production: production.list, issues: issues.list, returns: returns.list }),
    [production.list, issues.list, returns.list])
  const m = useMemo(() => machineLoad(masters, data, days), [masters, data, days])
  const v = VERDICT[m.verdict]

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <Card className="p-3">
        <FieldLabel>Based on the last</FieldLabel>
        <Select className="mt-1" value={String(days)} onChange={e => setDays(Number(e.target.value))}
          options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }]} />
      </Card>

      <Card className={`p-4 border ${v.cls}`}>
        <div className="text-base font-bold">{v.label}</div>
        <div className="text-sm mt-1 opacity-90">{m.reason}</div>
      </Card>

      <Card className="p-4 space-y-3">
        <FieldLabel>How full would ONE machine be? (per month)</FieldLabel>
        <div>
          <div className="flex justify-between text-sm mb-1"><span>1 shift/day</span><span className="font-mono font-bold">{fmtNum(m.capacity.fill1)}%</span></div>
          <Bar pct={m.capacity.fill1} />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1"><span>2 shifts/day</span><span className="font-mono font-bold">{fmtNum(m.capacity.fill2)}%</span></div>
          <Bar pct={m.capacity.fill2} />
        </div>
        <div className="text-xs text-slate-500">≈ {fmtNum(m.monthly.hours)} machine-hrs/month of work vs {fmtNum(m.capacity.oneShiftHrs)} hrs (1 shift) available.</div>
      </Card>

      <Card className="p-4 space-y-2">
        <FieldLabel>Monthly volume (scaled from {m.days} days)</FieldLabel>
        <Row label="Pieces / month" val={fmtNum(m.monthly.pieces)} />
        <Row label="Outsource job-work / month" val={`₹${fmtNum(m.monthly.spend)}`} />
        {m.perProduct.length > 0 && (
          <div className="pt-1 border-t text-xs text-slate-500">
            {m.perProduct.map(p => <div key={p.name} className="flex justify-between"><span>{p.name}</span><span className="font-mono">{fmtNum(p.pieces)} pcs</span></div>)}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <FieldLabel>In-house vs outsource (conversion cost / piece)</FieldLabel>
        <Row label="Outsource now" val={m.economics.outsourcePerPiece != null ? `₹${fmtNum(m.economics.outsourcePerPiece)}` : '—'} />
        <Row label="In-house (if you buy)" val={m.economics.inhousePerPiece != null ? `₹${fmtNum(m.economics.inhousePerPiece)}` : '—'} strong />
        <div className="pt-1 border-t text-xs text-slate-500 space-y-0.5">
          <div className="flex justify-between"><span>Fixed/month (operator+rent+depr+maint)</span><span className="font-mono">₹{fmtNum(m.economics.monthlyFixed)}</span></div>
          <div className="flex justify-between"><span>Electricity/month (~{fmtNum(m.economics.avgKw)} kW × {fmtNum(m.monthly.hours)} hr)</span><span className="font-mono">₹{fmtNum(m.economics.monthlyElectricity)}</span></div>
          <div className="flex justify-between font-semibold text-slate-600"><span>Total in-house/month</span><span className="font-mono">₹{fmtNum(m.economics.monthlyTotal)}</span></div>
        </div>
        {m.economics.savingPerPiece != null && (
          <Row label="Saving / piece" val={`₹${fmtNum(m.economics.savingPerPiece)}`} />
        )}
        {m.economics.paybackMonths != null && m.economics.paybackMonths > 0 && (
          <Row label={`Payback on ₹${fmtNum(m.economics.machineCost)}`} val={`${fmtNum(m.economics.paybackMonths)} months`} strong />
        )}
        <div className="text-[11px] text-slate-400 pt-1">Material + nut cost the same either way — only the conversion (machine + labour + power) differs. Set your real machine/operator/power figures in config to sharpen this.</div>
      </Card>
    </div>
  )
}

function Bar({ pct }) {
  return (
    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-slate-400'}`}
        style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function Row({ label, val, strong }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-mono ${strong ? 'font-bold text-slate-800' : 'text-slate-700'}`}>{val}</span>
    </div>
  )
}
