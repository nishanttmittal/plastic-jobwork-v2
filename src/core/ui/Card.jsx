/** Card — steel surface used throughout the app (Machined Instrument theme). */
export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-steel border border-hairline rounded-2xl ${className}`} {...props}>
      {children}
    </div>
  )
}

/** Small uppercase section label, used above fields. */
export function FieldLabel({ children, className = '' }) {
  return (
    <span className={`text-sm font-bold text-muted uppercase tracking-wide ${className}`}>
      {children}
    </span>
  )
}
