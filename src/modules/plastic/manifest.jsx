/**
 * Plastic Job Work — module manifest. Implements the shell contract:
 *   id, title, icon, Provider, pages[]
 *
 * Navigation is organised around the daily jobs (nav:true → bottom nav):
 *   OWNER:   🏠 Home · ➕ Record · 👥 Moulders · 🏷️ Costing · ☰ More
 *   MANAGER: ➕ Record · 📦 Material · ☰ More
 * Secondary screens (Stock, Lot Report, Machine Load, Entries, Masters, Admin)
 * live under More. Material is manager-only (owner sees the same in/out on Home
 * + Lot Report). The old 15-day Report was a duplicate aggregator and was
 * removed; its unique rejection breakdown now lives inside Lot Report.
 */
import { PlasticProvider } from './PlasticContext'
import Home from './pages/Home'
import Record from './pages/Record'
import Moulders from './pages/Moulders'
import Costing from './pages/Costing'
import More from './pages/More'
import MaterialLog from './pages/MaterialLog'
import Entries from './pages/Entries'
import LotReport from './pages/LotReport'
import MachineLoad from './pages/MachineLoad'
import Stock from './pages/Stock'
import Masters from './pages/Masters'
import Admin from './pages/Admin'

export const plasticModule = {
  id: 'plastic',
  title: 'Plastic Job Work',
  icon: '🧩',
  Provider: PlasticProvider,
  pages: [
    // Primary — bottom nav. Home stays first so OWNER lands on Home; MANAGER
    // (no Home access) lands on Record. MANAGER sees ONLY: Record + Material + More.
    { key: 'home',     title: 'Home',     icon: '🏠', nav: true, roles: ['owner'], Component: Home },
    { key: 'record',   title: 'Record',   icon: '➕', nav: true, roles: ['manager', 'owner'], Component: Record },
    { key: 'material', title: 'Material',  icon: '📦', nav: true, roles: ['manager'], Component: MaterialLog },
    { key: 'moulders', title: 'Moulders', icon: '👥', nav: true, roles: ['owner'], Component: Moulders },
    { key: 'costing',  title: 'Costing',  icon: '🏷️', nav: true, roles: ['owner'], Component: Costing },
    { key: 'more',     title: 'More',     icon: '☰', nav: true, roles: ['manager', 'owner'], Component: More },
    // Secondary — opened from More (owner only).
    { key: 'stock',   title: 'Stock',          icon: '📦', desc: 'Raw material, purchases, prices', roles: ['owner'], Component: Stock },
    { key: 'lotreport', title: 'Lot Report',   icon: '🧾', desc: 'Per-lot sent vs received + cost/pc + PDF', roles: ['owner'], Component: LotReport },
    { key: 'machine',   title: 'Machine Load', icon: '🏭', desc: 'Buy-a-machine signal: capacity & break-even', roles: ['owner'], Component: MachineLoad },
    { key: 'entries', title: 'Entries',        icon: '📜', desc: 'Every entry · void',           roles: ['owner'], Component: Entries },
    { key: 'masters', title: 'Masters & Rates', icon: '🗂️', desc: 'Compounds, nuts, molders, products', roles: ['owner'], Component: Masters },
    { key: 'admin',   title: 'Admin',          icon: '⚙️', desc: 'Backup, logs, void & reset',   roles: ['owner'], Component: Admin },
  ],
}
