import React from 'react';
import { Tag } from '../ui/Tag';
import { Icon } from '../ui/Icon';
import { BtnOutline } from '../ui/Button';
import { typeColors } from '../../data/reportsData';

export default function ReportRow({ report, isLast, onSelect, onDownload }) {
  const colors = typeColors[report.type];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(report)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(report)}
      className={`flex items-center gap-4 px-6 py-4 transition-colors duration-150 cursor-pointer hover:bg-surface-lowest ${
        !isLast ? 'border-b border-outline-variant' : ''
      }`}
    >
      <Icon name={report.icon} size={22} color={colors.color} />
      <div className="flex-1">
        <div className="text-sm font-bold text-onSurface">{report.title}</div>
        <div className="text-xs text-onSurface-variant mt-0.5">{report.date} · {report.size}</div>
      </div>
      <Tag label={report.type} color={colors.color} bg={colors.bg} />
      <BtnOutline
        className="px-3 py-1.5"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(report);
        }}
      >
        <Icon name="download" size={14} /> Download
      </BtnOutline>
    </div>
  );
}