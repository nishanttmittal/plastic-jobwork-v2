/**
 * Temporary placeholder for screens being rebuilt in later plans. Keeps the
 * shell fully navigable while each premium screen is built one at a time.
 */
export default function Placeholder({ title = 'Screen' }) {
  return (
    <div className="max-w-lg mx-auto px-6 pt-20 text-center">
      <div className="font-display text-lg font-semibold text-chrome">{title}</div>
      <div className="text-muted text-sm mt-2">This screen arrives in the next build.</div>
    </div>
  )
}
