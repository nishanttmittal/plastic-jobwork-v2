/**
 * Jobs — one place for "where does each job stand". A segmented switch between
 * the two views, reusing the existing tested screens (no logic duplicated):
 *   • Moulders — per-molder material balance, pending, money + Hisab PDF
 *   • Lots     — per-lot sent-vs-received reconciliation + cost/pc + finalize
 * Owner-only (both show rates/money).
 */
import { useState } from 'react'
import Moulders from './Moulders'
import LotReport from './LotReport'

const TABS = [
  { key: 'moulders', label: 'Moulders', hint: 'Balance · pending · money',     Comp: Moulders },
  { key: 'lots',     label: 'Lots',     hint: 'Reconciliation · cost · PDF',   Comp: LotReport },
]

export default function Jobs(props) {
  const [tab, setTab] = useState('moulders')
  const Active = (TABS.find(t => t.key === tab) || TABS[0]).Comp

  return (
    <div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 bg-graphite border border-hairline rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-xl py-2 text-sm font-bold transition ${
                tab === t.key ? 'bg-steel text-amber border border-hairline' : 'text-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted text-center mt-2">{TABS.find(t => t.key === tab)?.hint}</p>
      </div>
      <Active {...props} />
    </div>
  )
}
