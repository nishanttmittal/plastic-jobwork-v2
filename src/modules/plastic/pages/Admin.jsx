/**
 * Admin — password-gated tools: backup / restore (JSON), recent activity log,
 * void entries, and a guarded reset. Keeps history safe (void, not delete).
 */
import { useState } from 'react'
import { usePlastic } from '../PlasticContext'
import { Button, Card, FieldLabel, Select } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { ADMIN_PASSWORD, OWNER_EMAILS } from '../config'
import { isLotFinalized } from '../logic/lot'

export default function Admin() {
  const ctx = usePlastic()
  const { production, issues, returns, purchases, payments, logs, masters, log, lotLocks } = ctx
  const [ok, setOk] = useState(false)
  const [pw, setPw] = useState('')

  if (!ok) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card className="p-6 space-y-3 text-center">
          <div className="text-3xl">🔒</div>
          <FieldLabel>Admin password</FieldLabel>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            className="w-full border-2 border-hairline rounded-2xl px-4 py-3 text-center text-lg text-chrome bg-graphite placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber" />
          <Button className="w-full" onClick={() => setOk(pw === ADMIN_PASSWORD)}>Unlock</Button>
          {pw && pw !== ADMIN_PASSWORD && <p className="text-signal-red text-sm">Wrong password</p>}
        </Card>
      </div>
    )
  }

  const backup = () => {
    const blob = {
      app: 'plastic-jobwork', exportedAt: new Date().toISOString(),
      production: production.list, issues: issues.list, returns: returns.list, purchases: purchases.list, payments: payments.list,
      logs: logs.list, masters,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `plastic-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    log('BACKUP', 'Downloaded JSON backup', 'admin')
  }

  const restore = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result)
        if (!confirm('Restore will REPLACE all current data with the backup. Continue?')) return
        if (Array.isArray(d.production)) production.replaceAll(d.production)
        if (Array.isArray(d.issues)) issues.replaceAll(d.issues)
        if (Array.isArray(d.returns)) returns.replaceAll(d.returns)
        if (Array.isArray(d.purchases)) purchases.replaceAll(d.purchases)
        if (Array.isArray(d.payments)) payments.replaceAll(d.payments)
        if (d.masters) {
          ctx.setCompounds(d.masters.compounds || [])
          ctx.setMasterbatch(d.masters.masterbatch || [])
          ctx.setInserts(d.masters.inserts || [])
          ctx.setMolders(d.masters.molders || [])
          ctx.setProducts(d.masters.products || [])
        }
        log('RESTORE', `Restored from ${file.name}`, 'admin')
        alert('✅ Restored. Refresh if anything looks stale.')
      } catch { alert('Invalid backup file') }
    }
    reader.readAsText(file)
  }

  const voidEntry = (id) => {
    const e = production.list.find(x => x.id === id)
    if (isLotFinalized(e?.lotNo, lotLocks)) { alert(`🔒 ${e.lotNo} is finalized — reopen it in Lot Report first.`); return }
    const reason = prompt('Reason for voiding this entry?'); if (reason == null) return
    production.update(id, { voided: true, voidReason: reason })
    log('VOID', `Voided ${id}: ${reason}`, 'admin')
  }

  const resetAll = () => {
    if (!confirm('⚠️ This clears ALL production, issues, returns, purchases and payments (masters kept). Sure?')) return
    if (!confirm('This cannot be undone. Confirm again.')) return
    production.replaceAll([]); issues.replaceAll([]); returns.replaceAll([]); purchases.replaceAll([]); payments.replaceAll([])
    log('RESET', 'Cleared all transactions', 'admin')
  }

  const recent = [...production.list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10)
  const recentLogs = [...logs.list].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 20)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Card className="p-4 space-y-3">
        <FieldLabel>Backup & Restore</FieldLabel>
        <Button className="w-full" onClick={backup}>⬇️ Download backup (JSON)</Button>
        <label className="block">
          <span className="text-sm text-muted">Restore from backup</span>
          <input type="file" accept="application/json" onChange={restore} className="mt-1 w-full text-sm text-muted" />
        </label>
      </Card>

      <Users />

      <Card className="p-4">
        <FieldLabel>Recent production (void if wrong)</FieldLabel>
        <div className="mt-2 divide-y divide-hairline">
          {recent.length === 0 && <p className="text-sm text-muted">None yet.</p>}
          {recent.map(e => {
            const pcs = (e.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
            return (
              <div key={e.id} className="flex justify-between items-center py-2 text-sm">
                <span className={e.voided ? 'line-through text-muted' : 'text-chrome'}>
                  {e.entryNo} · {fmtDate(e.date)} · {fmtNum(pcs)} pcs · ₹{fmtNum(e.costSnapshot?.grandTotal || 0)}
                </span>
                {!e.voided && <button onClick={() => voidEntry(e.id)} className="text-signal-red text-xs font-bold">Void</button>}
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-4">
        <FieldLabel>Activity log</FieldLabel>
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
          {recentLogs.map((l, i) => (
            <div key={i} className="text-xs text-muted">
              <span className="font-mono">{(l.ts || '').slice(0, 16).replace('T', ' ')}</span> · <b className="text-chrome">{l.action}</b> · {l.detail}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 !border-signal-red/30">
        <FieldLabel className="text-signal-red">Danger zone</FieldLabel>
        <Button variant="danger" className="w-full mt-2" onClick={resetAll}>Clear all transactions</Button>
      </Card>
    </div>
  )
}

/** Users & Access — owner grants Manager (or Admin) logins by email. */
function Users() {
  const { users, log } = usePlastic()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('manager')

  const add = () => {
    const e = email.trim().toLowerCase()
    if (!e || !e.includes('@')) return
    // doc id = email so the security rules can resolve the role directly.
    users.insert({ id: e, email: e, name: name.trim(), role, active: true })
    log('USER_ADD', `${e} as ${role}`, 'admin')
    setEmail(''); setName('')
  }
  const toggle = (u) => { users.update(u.id, { active: !(u.active !== false) }); log('USER_TOGGLE', `${u.email} → ${u.active !== false ? 'disabled' : 'active'}`, 'admin') }
  const del = (u) => { if (confirm(`Remove ${u.email}?`)) { users.remove(u.id); log('USER_REMOVE', u.email, 'admin') } }

  const RAW = 'w-full border-2 border-hairline rounded-xl px-3 py-2 text-sm text-chrome bg-graphite placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber'

  return (
    <Card className="p-4">
      <FieldLabel>Users & Access</FieldLabel>
      <p className="text-xs text-muted mt-1">Owner ({OWNER_EMAILS[0]}) always has full access. Add a Manager so they can record material sent &amp; received.</p>
      <div className="mt-2 divide-y divide-hairline">
        {users.list.length === 0 && <p className="text-sm text-muted py-2">No managers added yet.</p>}
        {users.list.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2 text-sm">
            <span className={u.active === false ? 'text-muted line-through' : 'text-chrome'}>
              {u.email} · <b>{u.role}</b>{u.name ? ` · ${u.name}` : ''}
            </span>
            <span className="flex gap-2">
              <button onClick={() => toggle(u)} className="text-amber text-xs font-bold">{u.active === false ? 'Enable' : 'Disable'}</button>
              <button onClick={() => del(u)} className="text-signal-red text-xs font-bold">Remove</button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-hairline pt-3">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@gmail.com (their Google login)"
          className={RAW} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)"
          className={RAW} />
        <div className="flex gap-2">
          <Select options={[{ value: 'manager', label: 'Manager (material in/out)' }, { value: 'owner', label: 'Admin (full)' }]}
            value={role} onChange={e => setRole(e.target.value)} className="!py-2 !text-sm flex-1" />
          <Button size="sm" onClick={add}>Add</Button>
        </div>
      </div>
    </Card>
  )
}
