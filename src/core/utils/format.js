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
 * A count with an explicit weight (kg) in brackets — the owner's standing rule:
 * material moving in/out is tracked by weight, shown as "count (kg)".
 * e.g. fmtCountKg(18072, 150) → "18,072 (150 kg)". Prefer this for NUTS, whose
 * weight is stored per entry (nut size differs lot to lot). kg 0/undefined →
 * plain count, so callers stay safe.
 */
export const fmtCountKg = (count, kg) => {
  const c = Math.round(Number(count) || 0)
  const k = Number(kg) || 0
  if (!k) return fmtNum(c)
  const kgStr = k >= 100 ? fmtNum(k) : k.toFixed(k < 10 ? 2 : 1)
  return `${fmtNum(c)} (${kgStr} kg)`
}

/**
 * A piece count with its weight derived from a fixed grams-per-piece — use for
 * FINISHED PIECES (weight per piece is constant per product).
 * e.g. fmtPcsKg(11928, 45) → "11,928 (537 kg)".
 */
export const fmtPcsKg = (pieces, gPerPiece) =>
  fmtCountKg(pieces, ((Math.round(Number(pieces) || 0)) * (Number(gPerPiece) || 0)) / 1000)

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
