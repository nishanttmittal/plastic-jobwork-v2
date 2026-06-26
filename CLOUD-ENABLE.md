# Enabling cloud sync (Phase 1.5) — do ONLY with owner approval

Phase 1 runs local-only. To switch on real-time multi-device sync across phones
(owner + manager), three deliberate steps — none done yet:

## 1. Publish the Firestore rules (additive — keeps every other app unchanged)
Merge this block into the shared `unico-operations` ruleset (the same file all
UNICO apps share). It mirrors the plating app's pattern: any signed-in user
reads/writes plastic data; only the owner manages the access list.

```
// ---- plastic job work (apps/plasticjobwork) ----
function plPath()   { return /databases/$(database)/documents/apps/plasticjobwork/users/$(tEmail()); }
function plExists() { return tEmail() != '' && exists(plPath()); }
function plOwner()  { return signedIn() && (bootstrapOwner() ||
                       (plExists() && get(plPath()).data.role == 'owner' && get(plPath()).data.active == true)); }

match /apps/plasticjobwork/users/{uid} {
  allow read:  if signedIn();
  allow write: if plOwner();          // only owner can grant/revoke access
}
match /apps/plasticjobwork/{document=**} {
  allow read, write: if signedIn();   // day-to-day data (trusted team)
}
```

## 2. Build the plastic FirestoreProvider
Mirror `src/modules/plastic/PlasticContext.jsx` against the Firestore `paths`
already defined in `src/core/db/firebase.js` (production / issues / payments /
logs / users / meta masters + counter). Same value shape, so no page changes.
Wire it into `PlasticProvider` (branch on `isFirebaseConfigured`).

## 3. Flip the switch
In `src/core/db/firebaseConfig.js` set `PHASE1_LOCAL_ONLY = false`, then
`npm run deploy`. The app now requires Google sign-in (Admin → Users & Access
controls who gets in) and syncs across devices.

> Until then: keep links private, take regular Admin → Backup exports.
