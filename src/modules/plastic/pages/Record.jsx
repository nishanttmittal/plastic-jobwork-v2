/**
 * Record — single entry hub. One place to log every movement, with a segmented
 * switch between the three actions. Reuses the existing, tested entry screens
 * (no logic duplicated): Material out (issue) · Pieces in (production) · Material
 * back (return).
 */
import { useState } from 'react'
import IssueCompound from './IssueCompound'
import NewProduction from './NewProduction'
import ReturnMaterial from './ReturnMaterial'

const TABS = [
  { key: 'out',  label: 'Material out',  hint: 'Issue compound / nuts',   Comp: IssueCompound },
  { key: 'in',   label: 'Pieces in',     hint: 'Record production',        Comp: NewProduction },
  { key: 'back', label: 'Material back', hint: 'Molder returns material',  Comp: ReturnMaterial },
]

export default function Record(props) {
  const [tab, setTab] = useState('out')
  const Active = (TABS.find(t => t.key === tab) || TABS[0]).Comp

  return (
    <div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="grid grid-cols-3 gap-2 bg-slate-100 rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-xl py-2 text-sm font-bold transition ${
                tab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">{TABS.find(t => t.key === tab)?.hint}</p>
      </div>
      <Active {...props} />
    </div>
  )
}
