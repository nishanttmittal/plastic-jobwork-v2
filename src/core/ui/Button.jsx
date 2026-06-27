/**
 * Button — single source of truth for tappable actions.
 * Large touch targets by default (factory / mobile use). Variants keep colors
 * consistent across every module.
 */
const VARIANTS = {
  primary:  'bg-amber text-graphite shadow-lg shadow-amber/20 active:bg-amber/90',
  success:  'bg-signal-green text-graphite shadow-lg shadow-signal-green/20 active:bg-signal-green/90',
  danger:   'bg-signal-red text-white shadow-lg shadow-signal-red/20 active:bg-signal-red/90',
  neutral:  'bg-steel text-chrome border-2 border-hairline active:bg-graphite',
  ghost:    'bg-graphite text-chrome border border-hairline active:bg-steel',
}

const SIZES = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-5 py-3 text-base rounded-2xl',
  lg: 'px-6 py-5 text-lg rounded-2xl',
}

export default function Button({
  variant = 'primary', size = 'md', disabled, className = '', children, ...props
}) {
  const base = 'font-bold transition-all active:scale-95 disabled:bg-hairline disabled:text-muted disabled:shadow-none disabled:active:scale-100'
  return (
    <button
      disabled={disabled}
      className={`${base} ${SIZES[size]} ${disabled ? '' : VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
