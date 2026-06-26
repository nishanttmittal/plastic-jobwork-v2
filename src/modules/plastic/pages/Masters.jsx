/**
 * Masters & Rates — manage compounds, masterbatch, nuts/inserts, molders and
 * products (recipe/BOM). Changing a rate here affects FUTURE entries only;
 * past production keeps the cost snapshot it was saved with.
 */
import { useState } from 'react'
import { usePlastic } from '../PlasticContext'
import { Button, Card, FieldLabel, Select } from '../../../core/ui'
import { makeId } from '../../../core/db/repository'

const TABS = [
  { key: 'compounds', label: 'Compounds' },
  { key: 'masterbatch', label: 'Masterbatch' },
  { key: 'inserts', label: 'Nuts' },
  { key: 'molders', label: 'Molders' },
  { key: 'products', label: 'Products' },
]

export default function Masters() {
  const [tab, setTab] = useState('compounds')
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'compounds' && <RateList which="compounds" unit="₹/kg" />}
      {tab === 'masterbatch' && <RateList which="masterbatch" unit="₹/kg" />}
      {tab === 'inserts' && <RateList which="inserts" unit="₹ each" weight />}
      {tab === 'molders' && <Molders />}
      {tab === 'products' && <Products />}
    </div>
  )
}

/* ── Simple {name, rate} masters (nuts also carry weightG when `weight`) ───── */
function RateList({ which, unit, weight = false }) {
  const ctx = usePlastic()
  const list = ctx[which]
  const setList = ctx[`set${which[0].toUpperCase()}${which.slice(1)}`]
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [wt, setWt] = useState('')

  const add = () => {
    if (!name.trim()) return
    const row = { id: makeId(which), name: name.trim(), rate: Number(rate) || 0 }
    if (weight) row.weightG = Number(wt) || 0
    setList([...list, row])
    setName(''); setRate(''); setWt('')
  }
  const patch = (id, p) => setList(list.map(x => x.id === id ? { ...x, ...p } : x))
  const del = (id) => setList(list.filter(x => x.id !== id))

  return (
    <Card className="p-4 space-y-3">
      <FieldLabel>{which} ({unit}{weight ? ' · weight g each' : ''})</FieldLabel>
      {list.map(x => (
        <div key={x.id} className="flex gap-2 items-center">
          <input value={x.name} onChange={e => patch(x.id, { name: e.target.value })}
            className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <input type="number" value={x.rate} onChange={e => patch(x.id, { rate: Number(e.target.value) || 0 })}
            className="w-20 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-right" placeholder={unit} />
          {weight && (
            <input type="number" value={x.weightG ?? 0} onChange={e => patch(x.id, { weightG: Number(e.target.value) || 0 })}
              className="w-16 border-2 border-slate-200 rounded-xl px-2 py-2 text-sm font-mono text-right" title="grams each" placeholder="g" />
          )}
          <button onClick={() => del(x.id)} className="text-red-500 text-lg px-1">🗑</button>
        </div>
      ))}
      <div className="flex gap-2 items-center pt-2 border-t">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New name"
          className="flex-1 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm" />
        <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder={unit}
          className="w-20 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-right" />
        {weight && (
          <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder="g"
            className="w-16 border-2 border-slate-300 rounded-xl px-2 py-2 text-sm font-mono text-right" />
        )}
        <Button size="sm" onClick={add}>Add</Button>
      </div>
    </Card>
  )
}

/* ── Molders ──────────────────────────────────────────────────────────────── */
function Molders() {
  const { molders, setMolders } = usePlastic()
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const patch = (id, p) => setMolders(molders.map(x => x.id === id ? { ...x, ...p } : x))
  const del = (id) => setMolders(molders.filter(x => x.id !== id))
  const add = () => {
    if (!name.trim()) return
    setMolders([...molders, { id: makeId('mld'), name: name.trim(), shiftRate: Number(rate) || 0, gst: false, gstPct: 12, payMode: 'time', pieceRate: 0 }])
    setName(''); setRate('')
  }
  return (
    <Card className="p-4 space-y-3">
      <FieldLabel>Molders (₹ per 12-hr shift)</FieldLabel>
      {molders.map(x => (
        <div key={x.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <input value={x.name} onChange={e => patch(x.id, { name: e.target.value })}
              className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm" />
            <button onClick={() => del(x.id)} className="text-red-500 text-lg px-1">🗑</button>
          </div>
          <div className="flex gap-2 items-center text-sm">
            <span className="text-slate-500 w-24">Pay by</span>
            <select value={x.payMode || 'time'} onChange={e => patch(x.id, { payMode: e.target.value })}
              className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm">
              <option value="time">Time (shift / hour)</option>
              <option value="piece">Per piece</option>
            </select>
          </div>
          <div className="flex gap-2 items-center text-sm">
            <span className="text-slate-500 w-24">Shift rate ₹</span>
            <input type="number" value={x.shiftRate} onChange={e => patch(x.id, { shiftRate: Number(e.target.value) || 0 })}
              className="w-28 border-2 border-slate-200 rounded-xl px-3 py-2 font-mono text-right" />
          </div>
          {x.payMode === 'piece' && (
            <div className="flex gap-2 items-center text-sm">
              <span className="text-slate-500 w-24">Piece rate ₹</span>
              <input type="number" value={x.pieceRate ?? 0} onChange={e => patch(x.id, { pieceRate: Number(e.target.value) || 0 })}
                className="w-28 border-2 border-slate-200 rounded-xl px-3 py-2 font-mono text-right" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!x.gst} onChange={e => patch(x.id, { gst: e.target.checked })} />
            <span className="text-slate-600">Bills GST</span>
            {x.gst && (
              <input type="number" value={x.gstPct} onChange={e => patch(x.id, { gstPct: Number(e.target.value) || 0 })}
                className="w-16 border-2 border-slate-200 rounded-xl px-2 py-1 font-mono text-right" />
            )}
            {x.gst && <span className="text-slate-500">%</span>}
          </label>
        </div>
      ))}
      <div className="flex gap-2 items-center pt-2 border-t">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New molder"
          className="flex-1 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm" />
        <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="₹/shift"
          className="w-24 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-right" />
        <Button size="sm" onClick={add}>Add</Button>
      </div>
    </Card>
  )
}

/* ── Products (recipe / BOM) ──────────────────────────────────────────────── */
function Products() {
  const { products, setProducts, compounds, masterbatch, inserts } = usePlastic()
  const patch = (id, p) => setProducts(products.map(x => x.id === id ? { ...x, ...p } : x))
  const del = (id) => setProducts(products.filter(x => x.id !== id))
  const add = () => setProducts([...products, {
    id: makeId('prd'), name: 'New product', compoundId: compounds[0]?.id || '', gPerPiece: 0,
    netPartG: 0, mbId: '', mbPct: 0, cavities: 1, cycleSec: 0, inserts: [], finishedPieceG: 0, note: '',
  }])

  // Net plastic + nut(s) should ≈ the weighed finished-piece weight. If all
  // three are filled and they disagree by >5%, something's mis-measured.
  const nutWtPerPiece = (p) => (p.inserts || []).reduce((s, ins) => {
    const m = inserts.find(i => i.id === ins.insertId)
    return s + (Number(ins.qty) || 0) * (Number(m?.weightG) || 0)
  }, 0)

  const cmpOpts = compounds.map(c => ({ value: c.id, label: c.name }))
  const mbOpts = [{ value: '', label: '— none —' }, ...masterbatch.map(m => ({ value: m.id, label: m.name }))]
  const nutOpts = [{ value: '', label: '— none —' }, ...inserts.map(i => ({ value: i.id, label: i.name }))]

  const setInsert = (prod, idx, p) => {
    const arr = [...(prod.inserts || [])]; arr[idx] = { ...arr[idx], ...p }
    patch(prod.id, { inserts: arr })
  }
  const addInsert = (prod) => patch(prod.id, { inserts: [...(prod.inserts || []), { insertId: inserts[0]?.id || '', qty: 1 }] })
  const delInsert = (prod, idx) => patch(prod.id, { inserts: (prod.inserts || []).filter((_, j) => j !== idx) })

  return (
    <div className="space-y-3">
      {products.map(p => (
        <Card key={p.id} className="p-4 space-y-2">
          <div className="flex gap-2 items-center">
            <input value={p.name} onChange={e => patch(p.id, { name: e.target.value })}
              className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" />
            <button onClick={() => del(p.id)} className="text-red-500 text-lg px-1">🗑</button>
          </div>
          <Field label="Compound"><Select options={cmpOpts} value={p.compoundId} onChange={e => patch(p.id, { compoundId: e.target.value })} className="!py-2 !text-sm" /></Field>
          <Field label="Compound g/piece (COST, incl. waste)"><Num value={p.gPerPiece} onChange={v => patch(p.id, { gPerPiece: v })} /></Field>
          <Field label="Net plastic g/piece (RECON, in part)"><Num value={p.netPartG ?? 0} onChange={v => patch(p.id, { netPartG: v })} /></Field>
          <Field label="Masterbatch"><Select options={mbOpts} value={p.mbId} onChange={e => patch(p.id, { mbId: e.target.value })} className="!py-2 !text-sm" /></Field>
          <Field label="Masterbatch dose %"><Num value={p.mbPct} onChange={v => patch(p.id, { mbPct: v })} /></Field>
          <Field label="Cavities / shot"><Num value={p.cavities} onChange={v => patch(p.id, { cavities: v })} /></Field>
          <Field label="Cycle time sec (efficiency target)"><Num value={p.cycleSec ?? 0} onChange={v => patch(p.id, { cycleSec: v })} /></Field>
          <Field label="Finished pc weight g (check)"><Num value={p.finishedPieceG} onChange={v => patch(p.id, { finishedPieceG: v })} /></Field>
          {(() => {
            const exp = (Number(p.netPartG) || 0) + nutWtPerPiece(p)
            const fin = Number(p.finishedPieceG) || 0
            if (!(exp > 0 && fin > 0)) return null
            const off = Math.abs(fin - exp) > exp * 0.05
            return (
              <div className={`text-xs rounded-lg px-3 py-2 ${off ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                {off ? '⚠️' : '✓'} Net plastic {(Number(p.netPartG) || 0).toFixed(1)}g + nut {nutWtPerPiece(p).toFixed(1)}g = {exp.toFixed(1)}g vs finished {fin.toFixed(1)}g
                {off ? ' — re-check a weight.' : ''}
              </div>
            )
          })()}

          <div className="pt-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Nuts / inserts per piece</span>
            {(p.inserts || []).map((ins, idx) => (
              <div key={idx} className="flex gap-2 items-center mt-1">
                <Select options={nutOpts} value={ins.insertId} onChange={e => setInsert(p, idx, { insertId: e.target.value })} className="!py-2 !text-sm flex-1" />
                <input type="number" value={ins.qty} onChange={e => setInsert(p, idx, { qty: Number(e.target.value) || 0 })}
                  className="w-16 border-2 border-slate-200 rounded-xl px-2 py-2 text-sm font-mono text-right" />
                <button onClick={() => delInsert(p, idx)} className="text-red-500 px-1">✕</button>
              </div>
            ))}
            <button onClick={() => addInsert(p)} className="text-teal-600 text-sm font-bold mt-1">＋ Add nut</button>
          </div>

          <input value={p.note || ''} onChange={e => patch(p.id, { note: e.target.value })} placeholder="Note"
            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm mt-1" />
        </Card>
      ))}
      <Button variant="ghost" className="w-full" onClick={add}>＋ Add product</Button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500 w-40 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
function Num({ value, onChange }) {
  return <input type="number" value={value} onChange={e => onChange(Number(e.target.value) || 0)}
    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-right" />
}
