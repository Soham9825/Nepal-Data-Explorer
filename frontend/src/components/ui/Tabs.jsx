export const TabBtn = ({ active, onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={`
      ui-button rounded-sm font-hanken font-bold text-[12px] px-4 py-2 cursor-pointer transition-all duration-150
      uppercase tracking-[0.04em] border-none
      ${active ? 'bg-primary text-white' : 'bg-transparent text-onSurface-variant hover:bg-surface-high'}
      ${className}
    `}
  >
    {children}
  </button>
);
