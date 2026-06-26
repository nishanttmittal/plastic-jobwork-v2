/** Top navigation bar shown inside a module page; "Home" returns to the grid. */
export default function NavBar({ title, onHome, back = 'Home' }) {
  return (
    <header className="bg-steel text-chrome px-4 py-3 flex items-center gap-3 border-b border-hairline no-print">
      <button onClick={onHome} className="flex items-center gap-2 text-muted hover:text-chrome text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {back}
      </button>
      <div className="h-4 w-px bg-hairline" />
      <h1 className="text-base font-semibold">{title}</h1>
    </header>
  )
}
