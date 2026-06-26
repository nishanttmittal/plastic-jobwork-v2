/**
 * Costing — ONE clear price per piece, driven by two simple switches:
 *   • Include nut?   • Include scrap?
 * Details (assumptions, breakdown, reverse calc) are tucked into expanders so
 * the headline number stays front and centre. Owner-only (shows money).
 */
import { useState, useMemo } from 'react'
import { usePlastic } from '../PlasticContext'
import { Card, FieldLabel, Select, NumberInput } from '../../../core/ui'
import { fmtNum } from '../../../core/utils/format'
import { productMaterialCost, byId } from '../logic/costing'

const rupee = (n) => `₹${(Number(n) || 0).toFixed(2)}`

export default function Costing() {
  const { masters, molders } = usePlastic()
  const products = masters.products.filter(p => (Number(p.gPerPiece) || 0) > 0)

  const [productId, setProductId] = useState(products[0]?.id || '')
  const [molderId, setMolderId] = useState(molders[0]?.id || '')
  const product = byId(masters.products, productId)
  const molder = byId(masters.molders, molderId)

  const [includeNut, setIncludeNut] = useState(true)
  const [includeScrap, setIncludeScrap] = useState(false)
  const [scrapPct, setScrapPct] = useState('5')
  const [shotsPerHr, setShotsPerHr] = useState(String(product?.shotsPerHour || 70))
  // When the selected product changes, reset shots/hr to that product's default
  // (React's "adjust state during render" pattern — no effect, no cascading render).
  const [prevProductId, setPrevProductId] = useState(productId)
  if (productId !== prevProductId) {
    setPrevProductId(productId)
    setShotsPerHr(String(product?.shotsPerHour || 70))
  }
  const [shiftHrs, setShiftHrs] = useState('12')
  const [regrindPct, setRegrindPct] = useState('0')
  const [limitRegrind, setLimitRegrind] = useState(true)
  const [blendLimit, setBlendLimit] = useState('20')
  const [targetPrice, setTargetPrice] = useState('')
  const [targetWithNut, setTargetWithNut] = useState('1')

  const c = useMemo(() => {
    if (!product || !molder) return null
    const cavities = Number(product.cavities) || 1
    const piecesPerShift = cavities * (Number(shotsPerHr) || 0) * (Number(shiftHrs) || 0)
    const mat = productMaterialCost(product, masters)
    const cmp = byId(masters.compounds, product.compoundId)
    const rate = Number(cmp?.rate) || 0
    const runnerPerPiece = (Number(product.runnerGPerShot) || 0) / cavities
    const reuseInput = Math.max(0, Number(regrindPct) || 0)
    const limit = Math.max(0, Number(blendLimit) || 0)
    const effReusePct = limitRegrind ? Math.min(reuseInput, limit) : reuseInput
    const capped = limitRegrind && reuseInput > limit
    const regrindSaving = (runnerPerPiece * Math.min(1, effReusePct / 100) * rate) / 1000
    const compoundEff = Math.max(0, mat.compound - regrindSaving)
    const shiftCost = molder.gst ? (Number(molder.shiftRate) || 0) * (1 + (Number(molder.gstPct) || 0) / 100) : (Number(molder.shiftRate) || 0)
    const jobWork = piecesPerShift > 0 ? shiftCost / piecesPerShift : 0

    const W = includeScrap ? Math.min(0.95, (Number(scrapPct) || 0) / 100) : 0
    const f = 1 - W
    const baseNoNut = compoundEff + mat.masterbatch + jobWork
    const base = baseNoNut + (includeNut ? mat.nut : 0)
    const price = f > 0 ? base / f : base
    return {
      cavities, piecesPerShift, jobWork, shiftCost, rate,
      compound: mat.compound, compoundEff, regrindSaving, masterbatch: mat.masterbatch, nut: mat.nut,
      effReusePct, capped, price, materialOnly: compoundEff + mat.masterbatch, W,
    }
  }, [product, molder, masters, shotsPerHr, shiftHrs, regrindPct, limitRegrind, blendLimit, includeNut, includeScrap, scrapPct])

  const rev = useMemo(() => {
    const t = Number(targetPrice) || 0
    if (!c || t <= 0) return null
    const material = c.materialOnly + (targetWithNut === '1' ? c.nut : 0)
    const jwPiece = t - material
    const shiftIncl = jwPiece * c.piecesPerShift
    const gstMult = molder?.gst ? (1 + (Number(molder.gstPct) || 0) / 100) : 1
    return { t, material, jwPiece, shiftBeforeGst: shiftIncl / gstMult, shiftIncl, gst: !!molder?.gst, ok: jwPiece >= 0 }
  }, [c, targetPrice, targetWithNut, molder])

  const molderOpts = molders.map(m => ({ value: m.id, label: m.name }))
  const productOpts = products.map(p => ({ value: p.id, label: p.name }))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Product</FieldLabel><Select className="mt-1" options={productOpts} value={productId} onChange={e => setProductId(e.target.value)} /></div>
          <div><FieldLabel>Molder</FieldLabel><Select className="mt-1" options={molderOpts} value={molderId} onChange={e => setMolderId(e.target.value)} /></div>
        </div>
      </Card>

      {c && (
        <>
          {/* Headline price */}
          <Card className="p-5 text-center">
            <div className="text-5xl font-bold text-teal-700">{rupee(c.price)}</div>
            <div className="text-sm text-slate-500 mt-1">
              per piece · {includeNut ? 'with nut' : 'without nut'}{includeScrap ? ` · +${fmtNum(scrapPct)}% reject markup` : ''}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Chip on={includeNut} onClick={() => setIncludeNut(v => !v)}>Include nut</Chip>
              <Chip on={includeScrap} onClick={() => setIncludeScrap(v => !v)}>Reject markup</Chip>
              {includeScrap && (
                <span className="flex items-center gap-1 text-sm">
                  <span className="w-16"><NumberInput value={scrapPct} onChange={e => setScrapPct(e.target.value)} className="!py-1 text-center" /></span>% reject
                </span>
              )}
            </div>
            {includeScrap && (
              <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
                Raises the price so your <b>good</b> pieces cover the cost of <b>rejected</b> ones.
                Enter your typical reject %. (Runner / regrind reuse is separate — see Assumptions below.)
              </p>
            )}
          </Card>

          {/* Breakdown — always visible */}
          <Card className="p-4">
            <FieldLabel>Breakdown</FieldLabel>
            <div className="mt-2 space-y-1">
              <Row label={`Compound (${fmtNum(product.gPerPiece)} g)`} val={rupee(c.compound)} />
              {c.regrindSaving > 0 && <Row label={`Regrind reused (${fmtNum(c.effReusePct)}%${c.capped ? ', capped' : ''})`} val={`− ${rupee(c.regrindSaving)}`} />}
              {c.masterbatch > 0 && <Row label="Masterbatch" val={rupee(c.masterbatch)} />}
              {includeNut && <Row label="Nut / inserts" val={rupee(c.nut)} />}
              <Row label={`Job-work (₹${fmtNum(c.shiftCost)}/shift ÷ ${fmtNum(c.piecesPerShift)} pcs)`} val={rupee(c.jobWork)} />
              {includeScrap && <Row label={`Reject markup (${fmtNum(scrapPct)}% rejects)`} val={`× ${(1 / (1 - c.W)).toFixed(3)}`} />}
              <div className="border-t pt-1 mt-1"><Row label="Price per piece" val={rupee(c.price)} bold /></div>
            </div>
          </Card>

          {/* Assumptions */}
          <Expander title="Assumptions & regrind">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Shots / hour"><NumberInput value={shotsPerHr} onChange={e => setShotsPerHr(e.target.value)} /></Field>
              <Field label="Shift hours"><NumberInput value={shiftHrs} onChange={e => setShiftHrs(e.target.value)} /></Field>
              <Field label="Regrind %"><NumberInput value={regrindPct} onChange={e => setRegrindPct(e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 mt-2">
              <div className="text-sm font-semibold text-slate-700">Cap regrind at safe blend
                <span className="block text-xs font-normal text-slate-400">protects strength (15–20% typical)</span></div>
              <div className="flex items-center gap-2">
                {limitRegrind && <span className="w-14"><NumberInput value={blendLimit} onChange={e => setBlendLimit(e.target.value)} className="!py-1 text-center" /></span>}
                <button onClick={() => setLimitRegrind(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${limitRegrind ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>{limitRegrind ? 'ON' : 'OFF'}</button>
              </div>
            </div>
            {c.capped && <p className="text-xs text-amber-600 mt-1">Reuse capped at {fmtNum(blendLimit)}% — turn OFF to override.</p>}
            <p className="text-xs text-slate-400 mt-2">{fmtNum(c.cavities)} cavities × {fmtNum(shotsPerHr)} shots/hr × {fmtNum(shiftHrs)} hr = {fmtNum(c.piecesPerShift)} pcs/shift.</p>
          </Expander>

          {/* Reverse */}
          <Expander title="Reverse — target price → shift cost">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Target ₹/piece"><NumberInput value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="e.g. 5.70" /></Field>
              <Field label="Target is"><Select value={targetWithNut} onChange={e => setTargetWithNut(e.target.value)} options={[{ value: '1', label: 'with nut' }, { value: '0', label: 'without nut' }]} /></Field>
            </div>
            {rev && (rev.ok ? (
              <div className="mt-3 bg-rose-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-rose-700">≤ {rupee(rev.shiftBeforeGst)} / shift</div>
                <div className="text-xs text-slate-500 mt-0.5">to hit {rupee(rev.t)} {targetWithNut === '1' ? 'with' : 'without'} nut{rev.gst ? ` (₹${rev.shiftIncl.toFixed(0)} incl GST)` : ''} · job-work ≤ {rupee(rev.jwPiece)}/pc</div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-red-600 text-center">{rupee(rev.t)} is below material cost ({rupee(rev.material)}) — not possible even with a free shift.</p>
            ))}
          </Expander>
        </>
      )}
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-300'}`}>{on ? '✓ ' : ''}{children}</button>
}
function Expander({ title, children }) {
  return (
    <details className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <summary className="px-4 py-3 font-bold text-slate-700 text-sm cursor-pointer select-none">{title}</summary>
      <div className="px-4 pb-4 space-y-1">{children}</div>
    </details>
  )
}
function Row({ label, val, bold }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className={`font-mono ${bold ? 'font-bold' : ''}`}>{val}</span></div>
}
function Field({ label, children }) {
  return <div><span className="text-xs text-slate-500">{label}</span><div className="mt-1">{children}</div></div>
}
