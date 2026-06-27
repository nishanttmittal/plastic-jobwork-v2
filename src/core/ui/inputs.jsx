/**
 * Input primitives — shared styling for every form control so the whole app
 * looks consistent and stays touch-friendly. One place to restyle all inputs.
 */

const FIELD = 'w-full border-2 border-hairline rounded-2xl px-4 py-4 text-base font-semibold ' +
  'text-chrome bg-graphite placeholder:text-muted appearance-none ' +
  'focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber'

export function TextInput({ className = '', ...props }) {
  return <input type="text" className={`${FIELD} ${className}`} {...props} />
}

// inputMode="decimal" gives the iPhone keypad a decimal point, so rates, kg and
// prices like 5.70 can actually be typed (inputMode="numeric" showed an
// integer-only pad). Whole numbers still type fine on this pad.
export function NumberInput({ className = '', ...props }) {
  return <input type="number" inputMode="decimal" className={`${FIELD} ${className}`} {...props} />
}

export function DateInput({ className = '', ...props }) {
  return <input type="date" className={`${FIELD} ${className}`} {...props} />
}

export function Select({ options = [], className = '', ...props }) {
  return (
    <select className={`${FIELD} ${className}`} {...props}>
      {options.map(o => {
        const value = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return <option key={value} value={value}>{label}</option>
      })}
    </select>
  )
}

/**
 * NumberStepper — big −/＋ control with optional quick-add chips. Built for
 * fast factory data entry on a phone.
 */
export function NumberStepper({ value, onChange, quickAdds = [] }) {
  const n = Number(value) || 0
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))}
          className="w-14 h-14 rounded-2xl bg-graphite border border-hairline text-chrome text-3xl font-bold active:bg-steel flex-shrink-0">−</button>
        <input type="number" inputMode="numeric" value={value} placeholder="0"
          onChange={e => onChange(e.target.value)}
          className="flex-1 border-2 border-hairline rounded-2xl px-4 py-4 text-3xl font-bold text-center font-mono text-chrome bg-graphite placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber w-full min-w-0" />
        <button type="button" onClick={() => onChange(String(n + 1))}
          className="w-14 h-14 rounded-2xl bg-graphite border border-hairline text-chrome text-3xl font-bold active:bg-steel flex-shrink-0">+</button>
      </div>
      {quickAdds.length > 0 && (
        <div className="grid grid-cols-6 gap-1.5 mt-2.5">
          {quickAdds.map(q => (
            <button key={q} type="button" onClick={() => onChange(String(n + q))}
              className="py-2.5 rounded-xl bg-amber/10 text-amber font-bold text-sm active:bg-amber/20">+{q}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/** SearchBar — labelled search input with icon. */
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <svg className="w-5 h-5 text-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input type="search" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-hairline rounded-xl pl-10 pr-3 py-3 text-base text-chrome bg-graphite placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-amber" />
    </div>
  )
}
