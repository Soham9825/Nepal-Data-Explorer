
export const Tag = ({ label, color, bg }) => (
  <span
    className="inline-block text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-[2px]"
    style={{ background: bg, color }}
  >
    {label}
  </span>
);