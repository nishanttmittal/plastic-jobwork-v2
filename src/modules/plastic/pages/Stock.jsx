/**
 * Stock — raw-material store (owner). Current stock on hand (derived from
 * purchases − issued + returned), each material's average & latest lot price,
 * a reorder level (→ low-stock alert on Home), an "Add purchase" form that
 * records the lot price, a one-tap "use latest as costing rate", and the recent
 * purchase list (void). Buying is occasional, so it lives under More.
 */
import { useState, useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Button, Card, FieldLabel, Select, NumberInput, DateInput, TextInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { materialStock } from '../logic/stock'
import { byId } from '../logic/costing'

export default function Stock() {
  const { purchases, issues, returns, compounds, setCompounds, inserts, setInserts, masters, log } = usePlastic()
  const { msg, show } = useToast()
  const [adding, setAdding] = useState(false)
  const [reorderDraft, setReorderDraft] = useState({})

  const stock = useMemo(
    () => materialStock(masters, { purchases: purchases.list, issues: issues.list, returns: returns.list }),
    [masters, purchases.list, issues.list, returns.list],
  )

  // Add-purchase form
  const [date, setDate] = useState(todayStr())
  const [kind, setKind] = useState('compound')
  const [materialId, setMaterialId] = useState(compounds[0]?.id || '')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')

  const matOpts = kind === 'nut'
    ? inserts.map(n => ({ value: n.id, label: n.name }))
    : compounds.map(c => ({ value: c.id, label: c.name }))

  const onKind = (k) => { setKind(k); setMaterialId((k === 'nut' ? inserts[0]?.id : compounds[0]?.id) || '') }

  const savePurchase = () => {
    if (!materialId || !(Number(qty) > 0)) { show('Pick item & quantity', 2200); return }
    purchases.insert({
      date, kind, materialId, qty: Number(qty) || 0, rate: Number(rate) || 0,
      supplier, invoice, note: '', voided: false, createdAt: new Date().toISOString(),
    })
    const name = (kind === 'nut' ? byId(inserts, materialId) : byId(compounds, materialId))?.name || materialId
    log('PURCHASE', `${name} · ${fmtNum(qty)}${kind === 'nut' ? ' pcs' : ' kg'} @ ₹${fmtNum(rate)}`)
    show('✅ Purchase recorded', 1800)
    setQty(''); setRate(''); setSupplier(''); setInvoice(''); setAdding(false)
  }

  // reorder + rate edits on master items
  const commitReorder = (item) => {
    const v = reorderDraft[item.id]
    if (v === undefined) return
    const list = item.kind === 'nut' ? inserts : compounds
    const setter = item.kind === 'nut' ? setInserts : setCompounds
    setter(list.map(x => x.id === item.id ? { ...x, reorder: Number(v) || 0 } : x))
  }
  const applyLatestRate = (item) => {
    const list = item.kind === 'nut' ? inserts : compounds
    const setter = item.kind === 'nut' ? setInserts : setCompounds
    setter(list.map(x => x.id === item.id ? { ...x, rate: item.latest } : x))
    log('RATE', `${item.name} costing rate → ₹${fmtNum(item.latest)}`, 'owner')
    show(`${item.name} rate set to ₹${fmtNum(item.latest)}`, 2000)
  }

  const recent = [...purchases.list].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      {stock.lowItems.length > 0 && (
        <Card className="p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
          ⚠ Low stock: {stock.lowItems.map(i => `${i.name} (${fmtNum(i.stock)} ${i.unit})`).join(', ')}
        </Card>
      )}

      {/* Stock cards */}
      {stock.all.map(item => (
        <Card key={item.id} className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">{item.name}</span>
            {item.low && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">LOW</span>}
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className={`text-3xl font-bold ${item.stock < 0 ? 'text-red-600' : 'text-teal-700'}`}>{fmtNum(item.stock)} <span className="text-base text-slate-400">{item.unit}</span></div>
              <div className="text-xs text-slate-400 mt-0.5">in stock</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>avg ₹{fmtNum(item.avg)} · latest ₹{fmtNum(item.latest)}</div>
              <div className="mt-0.5">costing rate ₹{fmtNum(item.masterRate)}</div>
              {item.latest > 0 && item.latest !== item.masterRate && (
                <button onClick={() => applyLatestRate(item)} className="mt-1 text-teal-700 font-semibold underline">use latest as rate</button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Alert below</span>
            <span className="w-20">
              <NumberInput className="!py-1 text-center"
                value={reorderDraft[item.id] ?? (item.reorder || '')}
                onChange={e => setReorderDraft({ ...reorderDraft, [item.id]: e.target.value })}
                onBlur={() => commitReorder(item)} placeholder="0" />
            </span>
            <span className="text-xs text-slate-400">{item.unit}</span>
          </div>
        </Card>
      ))}

      {item_negativeHint(stock)}

      {/* Add purchase */}
      {!adding ? (
        <Button className="w-full" onClick={() => setAdding(true)}>＋ Add purchase</Button>
      ) : (
        <Card className="p-4 space-y-3">
          <FieldLabel>New purchase</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-xs text-slate-500">Date</span><DateInput value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            <div><span className="text-xs text-slate-500">Material</span><Select className="mt-1" value={kind} onChange={e => onKind(e.target.value)} options={[{ value: 'compound', label: 'Compound' }, { value: 'nut', label: 'Nut / insert' }]} /></div>
          </div>
          <div><span className="text-xs text-slate-500">Item</span><Select className="mt-1" value={materialId} onChange={e => setMaterialId(e.target.value)} options={matOpts} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-xs text-slate-500">Quantity ({kind === 'nut' ? 'pcs' : 'kg'})</span><NumberInput value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="mt-1" /></div>
            <div><span className="text-xs text-slate-500">Lot rate (₹/{kind === 'nut' ? 'pc' : 'kg'})</span><NumberInput value={rate} onChange={e => setRate(e.target.value)} placeholder="0" className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-xs text-slate-500">Supplier</span><TextInput value={supplier} onChange={e => setSupplier(e.target.value)} className="mt-1" /></div>
            <div><span className="text-xs text-slate-500">Invoice #</span><TextInput value={invoice} onChange={e => setInvoice(e.target.value)} className="mt-1" /></div>
          </div>
          {Number(qty) > 0 && Number(rate) > 0 && (
            <div className="text-center text-sm text-slate-500">Amount: <b className="text-slate-800">₹{fmtNum(Number(qty) * Number(rate))}</b></div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
            <Button className="flex-1" variant="success" onClick={savePurchase}>Save purchase</Button>
          </div>
        </Card>
      )}

      {/* Recent purchases */}
      <Card className="p-4">
        <FieldLabel>Recent purchases</FieldLabel>
        <div className="mt-2 divide-y divide-slate-50">
          {recent.length === 0 && <p className="text-sm text-slate-400">No purchases yet. Record one to start tracking stock.</p>}
          {recent.map(p => {
            const list = p.kind === 'nut' ? inserts : compounds
            const name = byId(list, p.materialId)?.name || p.materialId || p.kind
            return (
              <div key={p.id} className={`py-2 flex items-center justify-between text-sm ${p.voided ? 'opacity-40 line-through' : ''}`}>
                <div>
                  <div className="font-semibold text-slate-700">{name}</div>
                  <div className="text-xs text-slate-400">{fmtDate(p.date)} · {fmtNum(p.qty)} {p.kind === 'nut' ? 'pcs' : 'kg'} @ ₹{fmtNum(p.rate)}{p.supplier ? ` · ${p.supplier}` : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-600">₹{fmtNum((Number(p.qty) || 0) * (Number(p.rate) || 0))}</span>
                  {!p.voided && (
                    <button onClick={() => {
                      if (!window.confirm('Void this purchase?')) return
                      purchases.update(p.id, { voided: true })
                      log('VOID', `Purchase ${name} ${fmtNum(p.qty)} voided`, 'owner')
                    }} className="text-xs text-red-600 font-semibold">Void</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function item_negativeHint(stock) {
  const neg = stock.all.some(i => i.stock < 0)
  if (!neg) return null
  return (
    <p className="text-xs text-slate-400 text-center">
      Negative stock = material issued before its purchase was recorded. Add your opening / past purchases to correct it.
    </p>
  )
}
