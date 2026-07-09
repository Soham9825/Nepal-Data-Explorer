import React from 'react';

export const ProgressBar = ({ value, color, total = 100 }) => (
  <div className="h-2 bg-surface-highest rounded-full overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-600"
      style={{
        width: `${(value / total) * 100}%`,
        background: color,
      }}
    />
  </div>
);