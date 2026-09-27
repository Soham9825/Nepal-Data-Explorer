import { Icon } from '../ui/Icon';

export default function ActionCard({ title, desc, icon, color }) {
  return (
    <div
      className="bg-surface border border-outline-variant p-6 transition-colors duration-150 card-shadow"
      style={{ borderTop: `3px solid ${color}` }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e6bdb8')}
    >
      <Icon name={icon} size={28} color={color} className="block mb-3" />
      <h4 className="text-sm font-bold text-onSurface mb-1">{title}</h4>
      <p className="text-xs text-onSurface-variant mb-4">{desc}</p>
      <div
        className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.04em]"
        style={{ color }}
      >
        <Icon name="download" size={14} color={color} /> Download
      </div>
    </div>
  );
}
