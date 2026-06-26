/**
 * More — secondary menu. Holds the screens you don't need every day (Report,
 * Entries, Masters, Admin) plus sign-out, so the main nav stays focused on the
 * four daily jobs.
 */
/* global __APP_VERSION__ */
import { Card } from '../../../core/ui'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

export default function More({ pages = [], onOpen, onSignOut, userEmail }) {
  const secondary = pages.filter(p => !p.nav)
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {secondary.map(p => (
          <button key={p.key} onClick={() => onOpen(p.key)}
            className="bg-white rounded-2xl border border-slate-200 p-4 text-left active:scale-95 transition">
            <div className="text-2xl">{p.icon}</div>
            <div className="font-bold text-slate-800 mt-1">{p.title}</div>
            {p.desc && <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>}
          </button>
        ))}
      </div>

      {onSignOut && (
        <Card className="p-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Signed in</div>
            {userEmail && <div className="text-xs text-slate-400 truncate">{userEmail}</div>}
          </div>
          <button onClick={onSignOut} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-bold shrink-0">Sign out</button>
        </Card>
      )}

      <p className="text-center text-xs text-slate-400">App version {APP_VERSION} · updates automatically</p>
    </div>
  )
}
