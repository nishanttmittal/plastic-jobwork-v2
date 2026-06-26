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
import Placeholder from './pages/_Placeholder'
import Settings from './pages/Settings'
import Home from './pages/Home'

const ph = (title) => function PagePlaceholder(props) { return <Placeholder title={title} {...props} /> }

export const plasticModule = {
  id: 'plastic',
  title: 'Plastic Job Work',
  icon: '🧩',
  Provider: PlasticProvider,
  pages: [
    // Primary bottom nav. Home is first so OWNER lands on Home; MANAGER (no Home)
    // lands on Record. Material is manager-only.
    { key: 'home',     title: 'Home',     icon: '🏠', nav: true, roles: ['owner'], Component: Home },
    { key: 'record',   title: 'Record',   icon: '➕', nav: true, roles: ['manager', 'owner'], Component: ph('Record') },
    { key: 'jobs',     title: 'Jobs',     icon: '👥', nav: true, roles: ['owner'], Component: ph('Jobs') },
    { key: 'costing',  title: 'Costing',  icon: '🏷️', nav: true, roles: ['owner'], Component: ph('Costing') },
    { key: 'material', title: 'Material', icon: '📦', nav: true, roles: ['manager'], Component: ph('Material') },
    { key: 'more',     title: 'Settings', icon: '⚙️', nav: true, roles: ['manager', 'owner'], Component: Settings },
    // Secondary — opened from Settings (owner only).
    { key: 'stock',   title: 'Stock',        icon: '📦', desc: 'Raw material, purchases, prices', roles: ['owner'], Component: ph('Stock') },
    { key: 'machine', title: 'Machine Load', icon: '🏭', desc: 'Buy-a-machine signal', roles: ['owner'], Component: ph('Machine Load') },
    { key: 'qc',      title: 'QC / Reports', icon: '🧪', desc: 'Rejections & trends', roles: ['owner'], Component: ph('QC / Reports') },
    { key: 'entries', title: 'Entries',      icon: '📜', desc: 'Edit / void / audit', roles: ['owner'], Component: ph('Entries') },
    { key: 'masters', title: 'Masters',      icon: '🗂️', desc: 'Products, rates, moulders', roles: ['owner'], Component: ph('Masters') },
    { key: 'admin',   title: 'Admin',        icon: '⚙️', desc: 'Backup, restore', roles: ['owner'], Component: ph('Admin') },
  ],
}
