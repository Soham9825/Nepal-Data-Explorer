import React from 'react';

export default function NewsCard({ tag, tagColor, tagBg, time, headline, onClick }) {
  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && onClick) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="flex gap-4 p-4 border border-outline-variant rounded-sm transition-colors duration-150 hover:bg-surface-container-lowest cursor-pointer group"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={headline}
    >
      <div className="w-[3px] rounded-[2px] flex-shrink-0" style={{ background: tagColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-[2px]"
            style={{ background: tagBg, color: tagColor }}
          >
            {tag}
          </span>
          <span className="text-[10px] text-on-surface-variant">{time}</span>
        </div>
        <p className="text-[13px] font-semibold text-on-surface leading-[1.5] line-clamp-2">
          {headline}
        </p>
      </div>
      <span className="material-symbols-outlined text-[18px] self-center opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0">
        chevron_right
      </span>
    </div>
  );
}