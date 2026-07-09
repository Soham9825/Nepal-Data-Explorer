import React from 'react';
import ProgressBar from '../cards/ProgressBar';

export default function PopulationDistribution({ data = [] }) {
  const total = data.reduce((sum, p) => sum + parseInt(p.population.replace(/,/g, '')), 0);
  
  return (
    <div className="bg-surface border border-outline-variant rounded-sm p-6 card-shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-on-surface font-sans">Population Distribution</h3>
          <p className="text-on-surface-variant text-[12px] font-sans">By Province (2021 Census)</p>
        </div>
        <span className="text-xs text-on-surface-variant font-sans">
          Total: {(total / 1000000).toFixed(2)}M
        </span>
      </div>
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
        {data.map((p) => (
          <ProgressBar
            key={p.name}
            name={p.name}
            population={p.population}
            pct={p.pct}
            color={p.color}
          />
        ))}
      </div>
    </div>
  );
}