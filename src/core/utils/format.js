/**
 * Formatting & date helpers — pure, dependency-free, shared by all modules.
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** ISO yyyy-mm-dd for today (local). */
export const todayStr = () => new Date().toISOString().slice(0, 10)

/** ISO yyyy-mm-dd for N days ago. */
export const daysAgoStr = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** ISO yyyy-mm-dd from day/month/year numbers. */
export const toISODate = (d, m, y) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** dd/mm/yyyy for display. */
export const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Indian-format rupee/number, rounded to whole. */
export const fmtNum = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN')

/**
 * A piece count with its weight equivalent in brackets — the owner's standing
 * rule: material moving in/out is tracked by weight, shown as "pieces (kg)".
 * e.g. fmtPcsKg(18072, 8.3) → "18,072 (150 kg)". When gPerPiece is unknown
 * (0/undefined) it degrades to a plain count, so callers stay safe.
 */
export const fmtPcsKg = (pieces, gPerPiece) => {
  const p = Math.round(Number(pieces) || 0)
  const g = Number(gPerPiece) || 0
  if (!g) return fmtNum(p)
  const kg = (p * g) / 1000
  const kgStr = kg >= 100 ? fmtNum(kg) : kg.toFixed(kg < 10 ? 2 : 1)
  return `${fmtNum(p)} (${kgStr} kg)`
}

/**
 * Canonicalise a product name so the SAME physical product always matches as one
 * string across apps. The welder app emits curly inch/foot marks (e.g. 17”)
 * while this app uses straight quotes (17"); without this they'd be treated as
 * two different products and balances would never net. Folds curly quotes to
 * straight and collapses whitespace. Case is preserved (names are case-sensitive
 * across the UNICO apps). Pure, dependency-free.
 */
export const normalizeProductName = (s) =>
  String(s ?? '')
    .replace(/[“”″]/g, '"')   // “ ” ″  → "
    .replace(/[‘’′]/g, "'")   // ‘ ’ ′  → '
    .replace(/\s+/g, ' ')
    .trim()
