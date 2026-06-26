/**
 * Moulders — one place for "where does each molder stand". List of molder cards;
 * tap one for the full picture: material balance, pieces pending, nuts, money
 * (dues/advances/balance), add a payment, share the Hisab PDF, and recent
 * entries. Merges the old Moulder-Material + Hisab screens. Money is owner-only.
 */
import { useState, useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Button, Card, FieldLabel, Select, NumberInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { molderBalance } from '../logic/reconcile'
import { molderHisab, buildHisabPdf } from '../logic/hisab'
import { byId } from '../logic/costing'

export default function Moulders({ owner }) {
  const { molders, masters, production, issues, returns, payments } = usePlastic()
  const [selId, setSelId] = useState(null)

  const matData = { production: production.list, issues: issues.list, returns: returns.list, products: masters.products }
  const moneyData = { production: production.list, payments: payments.list }

  if (!selId) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-3">
        {molders.length === 0 && <Card className="p-6 text-center text-slate-400">No molders yet. Add them in More → Masters.</Card>}
        {molders.map(mo => {
          const b = molderBalance(mo.id, matData)
          const h = owner ? molderHisab(mo.id, masters, moneyData) : null
          return (
            <button key={mo.id} onClick={() => setSelId(mo.id)} className="w-full text-left">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{mo.name}</span>
                  {b.flag && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">🚩 check</span>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                  <Mini n={`${fmtNum(b.balanceKg)}kg`} l="material" tone={b.balanceKg < 0 ? 'text-red-600' : ''} />
                  <Mini n={fmtNum(b.pendingPieces)} l="pending" />
                  <Mini n={fmtNum(b.nutBalance)} l="nuts" />
                </div>
                {owner && h && (
                  <div className="mt-2 text-xs text-right text-slate-500">
                    {h.balance >= 0 ? 'You owe ' : 'Owes you '}<b className="text-slate-700">₹{fmtNum(Math.abs(h.balance))}</b>
                  </div>
                )}
              </Card>
            </button>
          )
        })}
      </div>
    )
  }

  return <MolderDetail molderId={selId} owner={owner} onBack={() => setSelId(null)} />
}

function Mini({ n, l, tone }) {
  return <div className="bg-slate-50 rounded-xl py-2"><div className={`font-bold ${tone || 'text-slate-800'}`}>{n}</div><div className="text-[11px] text-slate-500">{l}</div></div>
}
function Row({ label, val, bold, tone }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className={`font-mono ${bold ? 'font-bold' : ''} ${tone || ''}`}>{val}</span></div>
}

function MolderDetail({ molderId, owner, onBack }) {
  const { molders, masters, production, issues, returns, payments, log } = usePlastic()
  const { msg, show } = useToast()
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState('payment')

  const molder = byId(molders, molderId)
  const matData = { production: production.list, issues: issues.list, returns: returns.list, products: masters.products }
  const moneyData = { production: production.list, payments: payments.list }
  const b = molderBalance(molderId, matData)
  const h = owner ? molderHisab(molderId, masters, moneyData) : null

  const history = useMemo(() => {
    const out = []
    issues.list.filter(x => x.molderId === molderId).forEach(e => out.push({ t: 'Issued', date: e.date, ca: e.createdAt, v: e.voided, txt: `${fmtNum(e.compoundKg)}kg · ${fmtNum(e.nutQty)} nuts` }))
    production.list.filter(x => x.molderId === molderId).forEach(e => out.push({ t: 'Production', date: e.date, ca: e.createdAt, v: e.voided, txt: `${e.entryNo || ''} ${fmtNum((e.items || []).reduce((s, i) => s + (Number(i.pieces) || 0), 0))} pcs` }))
    returns.list.filter(x => x.molderId === molderId).forEach(e => out.push({ t: 'Returned', date: e.date, ca: e.createdAt, v: e.voided, txt: `${fmtNum(e.compoundKg)}kg · ${fmtNum(e.regrindKg)}kg regrind · ${fmtNum(e.nutQty)} nuts` }))
    return out.sort((a, z) => a.date !== z.date ? (a.date < z.date ? 1 : -1) : (z.ca || '').localeCompare(a.ca || '')).slice(0, 20)
  }, [molderId, issues.list, production.list, returns.list, molder])

  const addPayment = () => {
    if (!(Number(amount) > 0)) { show('Enter an amount', 1800); return }
    payments.insert({ date, molderId, amount: Number(amount), kind, note: '', voided: false, createdAt: new Date().toISOString() })
    log('PAYMENT', `${molder?.name || molderId} · ${kind} ₹${fmtNum(amount)}`)
    show('✅ Saved', 1500); setAmount('')
  }
  const sharePdf = async () => (await buildHisabPdf(molderId, masters, moneyData)).save(`Hisab-${(molder?.name || 'molder').replace(/\s+/g, '_')}.pdf`)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <button onClick={onBack} className="text-sm text-teal-700 font-semibold">‹ All molders</button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">{molder?.name || '(molder)'}</h2>
        {b.flag && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">🚩 check material</span>}
      </div>

      {/* Material */}
      <Card className="p-4">
        <FieldLabel>Material with this molder</FieldLabel>
        <div className="mt-2 space-y-1">
          <Row label="Issued (compound)" val={`${fmtNum(b.issuedKg)} kg`} />
          <Row label="Used in good pieces" val={`${fmtNum(b.plasticInProductsKg)} kg`} />
          <Row label="Regrind back (production)" val={`${fmtNum(b.regrindKg)} kg`} />
          <Row label="Burnt / purge loss" val={`${fmtNum(b.burntKg)} kg`} tone="text-amber-600" />
          <Row label="Returned unused + regrind" val={`${fmtNum(b.returnedKg)} kg`} />
          <div className="border-t pt-1 mt-1"><Row label="Balance with molder" val={`${fmtNum(b.balanceKg)} kg`} bold tone={b.balanceKg < 0 ? 'text-red-600' : 'text-teal-700'} /></div>
          <Row label="Nuts balance" val={fmtNum(b.nutBalance)} />
          <Row label="Pieces pending (approx)" val={`≈ ${fmtNum(b.pendingPieces)}`} bold tone="text-teal-700" />
        </div>
      </Card>

      {/* Money (owner only) */}
      {owner && h && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <FieldLabel>Money</FieldLabel>
            <button onClick={sharePdf} className="text-xs font-semibold text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5">Share PDF</button>
          </div>
          <div className="mt-2 space-y-1">
            <Row label="Dues (job work)" val={`₹${fmtNum(h.dues)}`} />
            <Row label="Advances given" val={`₹${fmtNum(h.advances)}`} />
            <Row label="Payments made" val={`₹${fmtNum(h.payments)}`} />
            <div className="border-t pt-1 mt-1"><Row label={h.balance >= 0 ? 'You owe molder' : 'Molder owes you'} val={`₹${fmtNum(Math.abs(h.balance))}`} bold /></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="col-span-1"><DateInput value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="col-span-1"><NumberInput value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" /></div>
            <div className="col-span-1"><Select value={kind} onChange={e => setKind(e.target.value)} options={[{ value: 'payment', label: 'Payment' }, { value: 'advance', label: 'Advance' }]} /></div>
          </div>
          <Button className="w-full mt-2" onClick={addPayment}>Add payment / advance</Button>
        </Card>
      )}

      {/* Recent entries */}
      <Card className="p-4">
        <FieldLabel>Recent entries</FieldLabel>
        <div className="mt-2 divide-y divide-slate-50">
          {history.length === 0 && <p className="text-sm text-slate-400">No entries yet.</p>}
          {history.map((e, i) => (
            <div key={i} className={`py-2 flex items-center justify-between text-sm ${e.v ? 'opacity-40 line-through' : ''}`}>
              <div><span className="text-xs font-semibold text-slate-500">{e.t}</span> · {e.txt}</div>
              <span className="text-xs text-slate-400">{fmtDate(e.date)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
