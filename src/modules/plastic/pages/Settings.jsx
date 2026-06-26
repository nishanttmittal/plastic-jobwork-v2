/**
 * Settings — the single "everything else" menu. Lists every secondary screen
 * (the non-nav pages the current role can see), one tap away, so the bottom bar
 * stays focused on the daily essentials. Data-driven from the manifest.
 */
import { InstrumentCard } from '../../../core/ui'

export default function Settings({ pages = [], onOpen, onSignOut }) {
  const items = pages.filter(p => !p.nav)
  return (
    <div className="max-w-lg mx-auto p-4 space-y-2">
      {items.map(p => (
        <button key={p.key} onClick={() => onOpen && onOpen(p.key)} className="w-full text-left">
          <InstrumentCard className="p-4 flex items-center gap-3">
            <span className="text-xl">{p.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold text-chrome">{p.title}</span>
              {p.desc && <span className="block text-xs text-muted">{p.desc}</span>}
            </span>
            <span className="text-muted">›</span>
          </InstrumentCard>
        </button>
      ))}
      {onSignOut && (
        <button onClick={onSignOut} className="w-full text-center text-sm text-muted py-4 mt-2">Sign out</button>
      )}
    </div>
  )
}
