/**
 * Firebase configuration.
 * ────────────────────────
 * These values are NOT secret — Firebase web config is meant to ship in the
 * client. Security comes from Firestore Rules + Auth, not from hiding these.
 *
 * PHASE 1 = LOCAL-ONLY.  This app deliberately runs on the device's local
 * storage for now (offline, single-device, no login) so it can be tested and
 * deployed WITHOUT touching the shared `unico-operations` Firestore rules.
 *
 * To turn ON cloud multi-device sync later (a deliberate, owner-approved step):
 *   1. publish the `apps/plasticjobwork/*` block in firestore.rules,
 *   2. build the plastic FirestoreProvider (mirrors the local provider API),
 *   3. set PHASE1_LOCAL_ONLY = false below.
 * Nothing else changes — every page already works against either backend.
 */

export const firebaseConfig = {
  apiKey:            'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain:        'unico-operations.firebaseapp.com',
  projectId:         'unico-operations',
  storageBucket:     'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId:             '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}

/** Cloud enabled 2026-06-16 (owner approved: Manager/Admin login like welder/plating). */
export const PHASE1_LOCAL_ONLY = false

/** True only when real values are present AND cloud mode is enabled. */
export const isFirebaseConfigured =
  !PHASE1_LOCAL_ONLY &&
  !Object.values(firebaseConfig).some(v => typeof v === 'string' && v.startsWith('PASTE_'))
