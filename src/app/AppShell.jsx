/**
 * AppShell — mounts the module inside its state Provider, behind Google sign-in.
 * Two roles: Manager and Admin (owner). Manager sees all pages except Admin;
 * Admin sees everything. Pages are filtered from the manifest by role.
 * Offline test mode (?local=1, no cloud) bypasses auth with full access.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import { isFirebaseConfigured } from '../core/db/firebaseConfig'
import NavBar from './NavBar'
import AuthGate from './AuthGate'

function Console({ module, role, onSwitch, userEmail }) {
  const pages = module.pages.filter(p => !p.roles || p.roles.includes(role))
  const navPages = pages.filter(p => p.nav)
  const [activeKey, setActiveKey] = useState(navPages[0]?.key || pages[0]?.key)
  const active = pages.find(p => p.key === activeKey) || navPages[0]
  const isSecondary = active && !active.nav

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {isSecondary && <NavBar title={active.title} back="More" onHome={() => setActiveKey('more')} />}
      {active && (
        <active.Component
          role={role} owner={role === 'owner'}
          pages={pages} onOpen={setActiveKey}
          onSignOut={onSwitch} userEmail={userEmail}
        />
      )}

      {/* Bottom nav — the four daily jobs + More */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex no-print z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navPages.map(p => {
          const on = active?.key === p.key || (isSecondary && p.key === 'more')
          return (
            <button key={p.key} onClick={() => setActiveKey(p.key)}
              className={`flex-1 flex flex-col items-center pt-2 pb-1.5 ${on ? 'text-teal-700' : 'text-slate-400'}`}>
              <span className="text-xl leading-none">{p.icon}</span>
              <span className="mt-0.5 text-[11px] font-semibold">{p.title}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module

  // Offline test mode (?local=1): no cloud, no auth — full access for testing.
  if (!isFirebaseConfigured) {
    return <Provider><Console module={module} role="owner" /></Provider>
  }

  return (
    <Provider>
      <AuthGate title={module.title} icon={module.icon}>
        {({ role, email, signOut }) => <Console module={module} role={role} onSwitch={signOut} userEmail={email} />}
      </AuthGate>
    </Provider>
  )
}
