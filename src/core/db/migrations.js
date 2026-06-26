/**
 * Migration Runner (version-safe schema evolution)
 * --------------------------------------------------
 * Stored data carries a schema version. On every app boot we compare the
 * stored version to the current code version and run any migrations in
 * between, in order. This lets the data shape evolve over releases WITHOUT
 * losing or corrupting a user's existing data.
 *
 * How to add a migration when you change the data shape:
 *   1. Bump CURRENT_VERSION below by 1.
 *   2. Add a function to the `migrations` array at the new index.
 *      Each migration receives the storage API and mutates stored data.
 *
 * Migrations are idempotent-by-version: a device only runs the steps it has
 * not seen yet, exactly once, then records the new version.
 */

import { storage } from './storage'

const VERSION_KEY = '__schema_version'

/**
 * The version the current code expects. MUST equal `migrations.length`.
 * Bump this (and add a migration) whenever the persisted shape changes.
 */
export const CURRENT_VERSION = 2

/**
 * Ordered migration steps. Index N upgrades data FROM version N TO N+1.
 * Keep every historical migration here forever — never edit old ones.
 *
 * @type {Array<(api: typeof storage) => void>}
 */
const migrations = [
  // v0 -> v1 : baseline. Establishes initial collections if a legacy
  // (pre-versioning) install is detected, otherwise a no-op for fresh installs.
  (api) => {
    // Migrate any data written by the original non-modular prototype
    // (keys: jwt_entries / jwt_parties / jwt_products on the bare localStorage).
    try {
      const legacy = (k) => {
        const raw = localStorage.getItem(k)
        return raw ? JSON.parse(raw) : null
      }
      const legacyEntries = legacy('jwt_entries')
      if (legacyEntries && !api.get('entries')) {
        api.set('entries', legacyEntries)
        const p = legacy('jwt_parties'); if (p) api.set('parties', p)
        const pr = legacy('jwt_products'); if (pr) api.set('products', pr)
      }
    } catch {
      /* fresh install — nothing to migrate */
    }
  },

  // v1 -> v2 : entries become CHALLANS (unique number + multi-product items).
  // Each legacy single-product entry is converted into a one-item challan,
  // assigned a sequential challan number. Original data is preserved as items.
  (api) => {
    const entries = api.get('entries')
    if (!Array.isArray(entries) || entries.length === 0) {
      if (api.get('challan_counter') == null) api.set('challan_counter', 0)
      return
    }
    if (api.get('challans')) return // already converted

    const pad = (n) => `PJW-${String(n).padStart(4, '0')}`
    // Preserve chronological order so challan numbers track entry order.
    const ordered = [...entries].sort(
      (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || (a.date || '').localeCompare(b.date || '')
    )
    let counter = 0
    const challans = ordered.map((e) => {
      counter += 1
      return {
        id: e.id || `c_${counter}`,
        challanNo: pad(counter),
        date: e.date,
        party: e.party,
        direction: e.direction,
        gaadi: e.gaadi || '',
        items: [{ product: e.product, quantity: Number(e.quantity) || 0 }],
        reconciled: false,
        reconcileReason: '',
        createdAt: e.createdAt || new Date().toISOString(),
      }
    })
    api.set('challans', challans)
    api.set('challan_counter', counter)
    if (api.get('logs') == null) api.set('logs', [])
  },
]

/**
 * Run all pending migrations. Call once at app startup, before rendering.
 * @returns {{from:number,to:number,ran:number}} summary for logging/telemetry
 */
export function runMigrations() {
  const from = storage.get(VERSION_KEY) ?? 0
  let ran = 0
  for (let v = from; v < CURRENT_VERSION; v++) {
    const step = migrations[v]
    if (typeof step === 'function') {
      step(storage)
      ran++
    }
  }
  if (from !== CURRENT_VERSION) storage.set(VERSION_KEY, CURRENT_VERSION)
  return { from, to: CURRENT_VERSION, ran }
}
