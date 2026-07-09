import React from 'react';

export const BtnPrimary = ({ children, onClick, className = '', style = {} }) => (
  <button
    onClick={onClick}
    className={`ui-button rounded-sm bg-primary text-white font-hanken font-bold text-[13px] px-5 py-2.5 border-none cursor-pointer flex items-center justify-center gap-1.5 h-10 min-h-[40px] transition-[filter] duration-150 hover:brightness-110 ${className}`}
    style={style}
  >
    {children}
  </button>
);

export const BtnOutline = ({ children, onClick, className = '', style = {} }) => (
  <button
    onClick={onClick}
    className={`ui-button rounded-sm bg-white border border-outline-variant text-onSurface font-hanken font-bold text-[12px] uppercase tracking-[0.05em] px-4 py-2 cursor-pointer flex items-center gap-1.5 transition-colors duration-150 hover:bg-surface-high ${className}`}
    style={style}
  >
    {children}
  </button>
);