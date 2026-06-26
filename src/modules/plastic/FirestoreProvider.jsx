/**
 * Firestore-backed Plastic Job Work state — real-time, multi-device, offline.
 *
 * Exposes the SAME value shape as the local provider (PlasticContext) so every
 * page works unchanged. Transaction collections (production/issues/payments/
 * logs/users) are per-document for concurrent-safe edits; masters live in meta
 * singleton docs ({ list:[...] }); entry numbers come from an atomic counter.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { onSnapshot, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore'
import { db, paths, ensureSignedIn, reserveChallanNumber } from '../../core/db/firebase'
import { makeNormalizer } from '../../core/schema/field'
import { makeId } from '../../core/db/repository'
import { productionSchema, issueSchema, returnSchema, purchaseSchema, paymentSchema, userSchema } from './schema'
import { SEED_COMPOUNDS, SEED_MASTERBATCH, SEED_INSERTS, SEED_MOLDERS, SEED_PRODUCTS } from './config'
import { formatEntryNo, entryCosting } from './logic/costing'
import { PlasticCtx } from './PlasticContext'

const normProd = makeNormalizer(productionSchema)
const normIssue = makeNormalizer(issueSchema)
const normReturn = makeNormalizer(returnSchema)
const normPurchase = makeNormalizer(purchaseSchema)
const normPay = makeNormalizer(paymentSchema)
const normUser = makeNormalizer(userSchema)

export function FirestoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState('')

  const [production, setProductionList] = useState([])
  const [issues, setIssuesList] = useState([])
  const [returns, setReturnsList] = useState([])
  const [purchases, setPurchasesList] = useState([])
  const [payments, setPaymentsList] = useState([])
  const [logsList, setLogsList] = useState([])
  const [usersList, setUsersList] = useState([])

  const [compounds, setCompoundsState] = useState(SEED_COMPOUNDS)
  const [masterbatch, setMasterbatchState] = useState(SEED_MASTERBATCH)
  const [inserts, setInsertsState] = useState(SEED_INSERTS)
  const [molders, setMoldersState] = useState(SEED_MOLDERS)
  const [products, setProductsState] = useState(SEED_PRODUCTS)
  const [lotLocks, setLotLocksState] = useState([])
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    let unsubs = []
    let done = false
    const timer = setTimeout(() => { if (!done) setTimedOut(true) }, 12000)
    const metaList = (snap, setter) => { if (snap.exists() && Array.isArray(snap.data().list)) setter(snap.data().list) }

    ensureSignedIn()
      .then(() => {
        unsubs.push(onSnapshot(paths.production(),
          (s) => { done = true; clearTimeout(timer); setProductionList(s.docs.map(d => normProd({ id: d.id, ...d.data() }))); setReady(true) },
          (e) => { done = true; clearTimeout(timer); setError(e.message); setReady(true) }))
        unsubs.push(onSnapshot(paths.issues(), (s) => setIssuesList(s.docs.map(d => normIssue({ id: d.id, ...d.data() })))))
        unsubs.push(onSnapshot(paths.returns(), (s) => setReturnsList(s.docs.map(d => normReturn({ id: d.id, ...d.data() })))))
        unsubs.push(onSnapshot(paths.purchases(), (s) => setPurchasesList(s.docs.map(d => normPurchase({ id: d.id, ...d.data() })))))
        // payments are owner-only in the rules; a manager's read is denied —
        // swallow that error so the console stays clean and money stays empty.
        unsubs.push(onSnapshot(paths.payments(),
          (s) => setPaymentsList(s.docs.map(d => normPay({ id: d.id, ...d.data() }))),
          () => setPaymentsList([])))
        unsubs.push(onSnapshot(paths.logs(), (s) => setLogsList(s.docs.map(d => ({ id: d.id, ...d.data() })))))
        unsubs.push(onSnapshot(paths.users(), (s) => setUsersList(s.docs.map(d => normUser({ id: d.id, ...d.data() })))))
        unsubs.push(onSnapshot(paths.compounds(), (s) => metaList(s, setCompoundsState)))
        unsubs.push(onSnapshot(paths.masterbatch(), (s) => metaList(s, setMasterbatchState)))
        unsubs.push(onSnapshot(paths.inserts(), (s) => metaList(s, setInsertsState)))
        unsubs.push(onSnapshot(paths.molders(), (s) => metaList(s, setMoldersState)))
        unsubs.push(onSnapshot(paths.products(), (s) => metaList(s, setProductsState)))
        unsubs.push(onSnapshot(paths.lotLocks(), (s) => metaList(s, setLotLocksState)))
        unsubs.push(onSnapshot(paths.counter(), (s) => setCounter(s.exists() ? (s.data().value || 0) : 0)))
      })
      .catch((e) => { done = true; clearTimeout(timer); setError(e.message); setTimedOut(true) })

    return () => { clearTimeout(timer); unsubs.forEach(u => u()) }
  }, [])

  const log = useCallback((action, detail, by = 'user') => {
    const id = makeId('log')
    setDoc(paths.logDoc(id), { id, ts: new Date().toISOString(), action, detail, by })
  }, [])

  // Generic per-doc collection API factory.
  const coll = (list, docRef, collRef) => ({
    list,
    insert: (rec) => { const id = rec.id || makeId('r'); const row = { createdAt: new Date().toISOString(), ...rec, id }; setDoc(docRef(id), row); return row },
    update: (id, patch) => setDoc(docRef(id), patch, { merge: true }),
    remove: (id) => deleteDoc(docRef(id)),
    replaceAll: async (rows) => {
      const existing = await getDocs(collRef())
      const b1 = writeBatch(db); existing.forEach(d => b1.delete(d.ref)); await b1.commit()
      const b2 = writeBatch(db); (rows || []).forEach(r => { const id = r.id || makeId('r'); b2.set(docRef(id), { ...r, id }) }); await b2.commit()
    },
    reset: async () => { const existing = await getDocs(collRef()); const b = writeBatch(db); existing.forEach(d => b.delete(d.ref)); await b.commit() },
  })

  const productionApi = coll(production, paths.productionDoc, paths.production)
  const issuesApi = coll(issues, paths.issueDoc, paths.issues)
  const returnsApi = coll(returns, paths.returnDoc, paths.returns)
  const purchasesApi = coll(purchases, paths.purchaseDoc, paths.purchases)
  const paymentsApi = coll(payments, paths.paymentDoc, paths.payments)
  const usersApi = coll(usersList, paths.user, paths.users)
  const logsApi = { list: logsList, insert: (rec) => log(rec.action, rec.detail, rec.by) }

  // Master setters write the whole list to the meta doc.
  const setCompounds = useCallback((list) => { setCompoundsState(list); setDoc(paths.compounds(), { list }) }, [])
  const setMasterbatch = useCallback((list) => { setMasterbatchState(list); setDoc(paths.masterbatch(), { list }) }, [])
  const setInserts = useCallback((list) => { setInsertsState(list); setDoc(paths.inserts(), { list }) }, [])
  const setMolders = useCallback((list) => { setMoldersState(list); setDoc(paths.molders(), { list }) }, [])
  const setProducts = useCallback((list) => { setProductsState(list); setDoc(paths.products(), { list }) }, [])
  const setLotLocks = useCallback((list) => { setLotLocksState(list); setDoc(paths.lotLocks(), { list }) }, [])

  const masters = useMemo(() => ({ compounds, masterbatch, inserts, molders, products }),
    [compounds, masterbatch, inserts, molders, products])

  const createEntry = useCallback(async (draft) => {
    const n = await reserveChallanNumber()
    const entryNo = formatEntryNo(n)
    const id = makeId('p')
    const costSnapshot = entryCosting({ ...draft, entryNo }, masters)
    const row = { ...draft, entryNo, costSnapshot, id, createdAt: new Date().toISOString() }
    await setDoc(paths.productionDoc(id), row)
    const pcs = (draft.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
    log('PRODUCTION', `${entryNo} · ${pcs} pcs · ₹${costSnapshot.grandTotal}`)
    return row
  }, [masters, log])

  const peekNextEntryNo = useCallback(() => formatEntryNo((counter || 0) + 1), [counter])

  // Render the app shell IMMEDIATELY — never a full-screen "Connecting…" gate.
  // With the persistent cache, cached data paints on first frame; the shell can
  // surface `cloud.syncing` (cold first load) or `cloud.timedOut` (can't reach
  // the cloud) as a thin, non-blocking banner instead of taking over the screen.
  const value = {
    production: productionApi, issues: issuesApi, returns: returnsApi, purchases: purchasesApi, payments: paymentsApi, logs: logsApi, users: usersApi,
    compounds, setCompounds, masterbatch, setMasterbatch, inserts, setInserts,
    molders, setMolders, products, setProducts,
    lotLocks, setLotLocks,
    masters, createEntry, peekNextEntryNo, log,
    cloud: { enabled: true, connected: !error, error, syncing: !ready, timedOut },
  }
  return <PlasticCtx.Provider value={value}>{children}</PlasticCtx.Provider>
}
