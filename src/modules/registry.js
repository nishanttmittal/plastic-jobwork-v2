/**
 * Module Registry — the list of factory modules the app knows about.
 *
 * This app hosts the Plastic Job Work module. Adding a future module is a
 * one-line change here once the module exports a manifest. The app shell reads
 * this registry; it has no hard-coded knowledge of any specific module.
 */
import { plasticModule } from './plastic/manifest'

export const modules = [
  plasticModule,
  // { future modules go here }
]

/** Look up a module by id. */
export const getModule = (id) => modules.find(m => m.id === id) || modules[0]
