/**
 * PlasticContext — module-wide reactive state for the Plastic Job Work app.
 *
 * Phase 1 runs on the LOCAL provider (offline, single-device). The provider
 * exposes a stable shape so pages never care about the backend; a cloud
 * (Firestore) provider with the same shape can be slotted in later.
 */
import { createContext, useContext, useCallback, useMemo } from 'react'
import { useCollection, useSingleton } from '../../core/hooks/useCollection'
import {
  productionRepo, issuesRepo, returnsRepo, purchasesRepo, paymentsRepo, logsRepo, usersRepo,
  compoundsStore, masterbatchStore, insertsStore, moldersStore, productsStore,
  counterStore, lotLocksStore,
} from './data'
import { formatEntryNo, entryCosting } from './logic/costing'
import { isFirebaseConfigured } from '../../core/db/firebaseConfig'
import { FirestoreProvider } from './FirestoreProvider'

const Ctx = createContext(null)
export { Ctx as PlasticCtx }

/** Backend selector: cloud (Firestore) when configured, else local storage. */
export function PlasticProvider({ children }) {
  return isFirebaseConfigured
    ? <FirestoreProvider>{children}</FirestoreProvider>
    : <LocalPlasticProvider>{children}</LocalPlasticProvider>
}

function LocalPlasticProvider({ children }) {
  const production = useCollection(productionRepo)
  const issues = useCollection(issuesRepo)
  const returns = useCollection(returnsRepo)
  const purchases = useCollection(purchasesRepo)
  const payments = useCollection(paymentsRepo)
  const logs = useCollection(logsRepo)
  const users = useCollection(usersRepo)

  const [compounds, setCompounds]     = useSingleton(compoundsStore)
  const [masterbatch, setMasterbatch] = useSingleton(masterbatchStore)
  const [inserts, setInserts]         = useSingleton(insertsStore)
  const [molders, setMolders]         = useSingleton(moldersStore)
  const [products, setProducts]       = useSingleton(productsStore)
  const [counter, setCounter]         = useSingleton(counterStore)
  const [lotLocks, setLotLocks]       = useSingleton(lotLocksStore)

  const masters = useMemo(
    () => ({ compounds, masterbatch, inserts, molders, products }),
    [compounds, masterbatch, inserts, molders, products],
  )

  const log = useCallback((action, detail, by = 'user') => {
    logs.insert({ ts: new Date().toISOString(), action, detail, by })
  }, [logs])

  /** Highest existing numeric entry suffix (authoritative against drift). */
  const highestExistingNo = useCallback(() => {
    let max = 0
    for (const e of production.list) {
      const m = /(\d+)\s*$/.exec(e.entryNo || '')
      if (m) max = Math.max(max, Number(m[1]))
    }
    return max
  }, [production.list])

  const peekNextEntryNo = useCallback(
    () => formatEntryNo(Math.max(counter || 0, highestExistingNo()) + 1),
    [counter, highestExistingNo],
  )

  /**
   * Create a production entry with a unique number and a locked cost snapshot
   * (so history keeps the rates it was computed at).
   */
  const createEntry = useCallback((draft) => {
    const existing = new Set(production.list.map(e => e.entryNo))
    let n = Math.max(counter || 0, highestExistingNo()) + 1
    let entryNo = formatEntryNo(n)
    while (existing.has(entryNo)) { n += 1; entryNo = formatEntryNo(n) }
    setCounter(n)
    const costSnapshot = entryCosting({ ...draft, entryNo }, masters)
    const row = production.insert({ ...draft, entryNo, costSnapshot })
    const pcs = (draft.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
    log('PRODUCTION', `${entryNo} · ${pcs} pcs · ₹${costSnapshot.grandTotal}`)
    return row
  }, [production, counter, setCounter, highestExistingNo, masters, log])

  const value = {
    production, issues, returns, purchases, payments, logs, users,
    compounds, setCompounds,
    masterbatch, setMasterbatch,
    inserts, setInserts,
    molders, setMolders,
    products, setProducts,
    lotLocks, setLotLocks,
    masters,
    createEntry, peekNextEntryNo, log,
    cloud: { enabled: isFirebaseConfigured },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider; dev-only fast-refresh hint
export function usePlastic() {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlastic must be used inside <PlasticProvider>')
  return v
}
