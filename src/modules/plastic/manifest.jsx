/**
 * Plastic Job Work — module manifest (premium rebuild). Shell contract:
 *   id, title, icon, Provider, pages[]
 *
 * Bottom nav (nav:true), the daily essentials:
 *   OWNER:   🏠 Home · ➕ Record · 👥 Jobs · 🏷️ Costing · ⚙️ Settings
 *   MANAGER: ➕ Record · 📦 Material · ⚙️ Settings
 * Everything else (Stock, Machine Load, QC/Reports, Entries, Masters, Admin)
 * lives one tap inside Settings (key 'more' — the shell's secondary-menu key).
 *
 * Phase-1 foundation: the essential screens render titled placeholders; the
 * premium screens are built in the next plans. Settings is already live.
 */
import { PlasticProvider } from './PlasticContext'
import Settings from './pages/Settings'
import Home from './pages/Home'
import Record from './pages/Record'
import Jobs from './pages/Jobs'
import Costing from './pages/Costing'
import MaterialLog from './pages/MaterialLog'
import Stock from './pages/Stock'
import MachineLoad from './pages/MachineLoad'
import Dashboard from './pages/Dashboard'
import Entries from './pages/Entries'
import Masters from './pages/Masters'
import Admin from './pages/Admin'

export const plasticModule = {
  id: 'plastic',
  title: 'Plastic Job Work',
  icon: '🧩',
  Provider: PlasticProvider,
  pages: [
    // Primary bottom nav. Home is first so OWNER lands on Home; MANAGER (no Home)
    // lands on Record. Material is manager-only.
    { key: 'home',     title: 'Home',     icon: '🏠', nav: true, roles: ['owner'], Component: Home },
    { key: 'record',   title: 'Record',   icon: '➕', nav: true, roles: ['manager', 'owner'], Component: Record },
    { key: 'jobs',     title: 'Jobs',     icon: '👥', nav: true, roles: ['owner'], Component: Jobs },
    { key: 'costing',  title: 'Costing',  icon: '🏷️', nav: true, roles: ['owner'], Component: Costing },
    { key: 'material', title: 'Material', icon: '📦', nav: true, roles: ['manager'], Component: MaterialLog },
    { key: 'more',     title: 'Settings', icon: '⚙️', nav: true, roles: ['manager', 'owner'], Component: Settings },
    // Secondary — opened from Settings (owner only).
    { key: 'stock',   title: 'Stock',        icon: '📦', desc: 'Raw material, purchases, prices', roles: ['owner'], Component: Stock },
    { key: 'machine', title: 'Machine Load', icon: '🏭', desc: 'Buy-a-machine signal', roles: ['owner'], Component: MachineLoad },
    { key: 'qc',      title: 'QC / Reports', icon: '🧪', desc: 'Rejections & trends', roles: ['owner'], Component: Dashboard },
    { key: 'entries', title: 'Entries',      icon: '📜', desc: 'Edit / void / audit', roles: ['owner'], Component: Entries },
    { key: 'masters', title: 'Masters',      icon: '🗂️', desc: 'Products, rates, moulders', roles: ['owner'], Component: Masters },
    { key: 'admin',   title: 'Admin',        icon: '⚙️', desc: 'Backup, restore', roles: ['owner'], Component: Admin },
  ],
}
