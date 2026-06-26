/**
 * App root.
 * Runs version-safe data migrations exactly once on boot (before any page
 * reads storage), then mounts the app shell for the Plastic Job Work module.
 */
import { useState } from 'react'
import { runMigrations } from './core/db/migrations'
import AppShell from './app/AppShell'

// Run migrations synchronously at module load, before React renders, so every
// repository read below sees data already at the current schema version.
runMigrations()

export default function App() {
  // Single registered module for this app: Plastic Job Work.
  const [moduleId] = useState('plastic')
  return <AppShell moduleId={moduleId} />
}
