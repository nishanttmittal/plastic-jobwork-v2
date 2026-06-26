/**
 * Machined Instrument primitives — the shared building blocks of the premium
 * rebuild. All colours/fonts come from the @theme tokens in index.css; no
 * hardcoded hex here.
 */

/** Steel surface card with a thin brushed-chrome highlight on the top edge. */
export function InstrumentCard({ className = '', children, ...props }) {
  return (
    <div className={`relative rounded-2xl bg-steel border border-hairline ${className}`} {...props}>
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </div>
  )
}

const TONE = { default: 'text-chrome', amber: 'text-amber', green: 'text-signal-green', red: 'text-signal-red' }

/** Big tabular-mono number with a small uppercase unit label — the signature. */
export function Readout({ value, label, tone = 'default', className = '' }) {
  return (
    <div className={`text-center ${className}`}>
      <div className={`font-mono tnum text-3xl font-bold ${TONE[tone] || TONE.default}`}>{value}</div>
      {label && <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-0.5">{label}</div>}
    </div>
  )
}

/** Status dot: read status before reading the number. */
export function StatusPip({ tone = 'green', className = '' }) {
  const c = { green: 'bg-signal-green', amber: 'bg-amber', red: 'bg-signal-red' }[tone] || 'bg-signal-green'
  return <span className={`inline-block w-2 h-2 rounded-full ${c} ${className}`} />
}
