import React from 'react';
import { Icon } from '../ui/Icon';
import { PROVINCE_PATHS, NEPAL_MAP_VIEWBOX } from '../../data/provincePaths';

// provincePopulation (from dummyData.js) is merged in by name to get
// population / pct stats onto the real geographic shapes below.
export default function ProvinceMap({ provinces, populationData, selectedProvince, onProvinceClick }) {
  const selectedId = selectedProvince?.id ?? null;

  // Build a lookup: province name -> stats from provincePopulation
  const statsByName = React.useMemo(() => {
    const map = {};
    (populationData || []).forEach((p) => {
      map[p.name] = p;
    });
    return map;
  }, [populationData]);

  const selectedShape = PROVINCE_PATHS.find((p) => p.id === selectedId);
  const selectedStats = selectedShape ? statsByName[selectedShape.name] : null;

  return (
    <div className="lg:col-span-2 bg-surface border border-outline-variant rounded-sm overflow-hidden flex flex-col relative card-shadow hover:border-primary transition-colors duration-200">
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <div>
          <h3 className="font-bold text-on-surface text-xl font-sans">
            Provincial Population Density
          </h3>
          <p className="text-on-surface-variant text-[12px] font-sans">
            Geographic distribution based on 2021 Census data
          </p>
          {selectedShape && (
            <p className="text-xs text-primary font-bold mt-1 flex items-center gap-1">
              <Icon name="check_circle" size={14} color="#b70011" />
              Selected: {selectedShape.name} Province
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <button className="bg-surface border border-outline-variant px-4 py-1.5 rounded-sm text-[12px] text-on-surface hover:bg-surface-container-highest font-bold font-sans flex items-center gap-1.5">
            <Icon name="filter_list" size={16} color="#5c403c" />
            Filter
          </button>
          <button className="bg-primary-container text-on-primary px-4 py-1.5 rounded-sm text-[12px] font-bold shadow-sm hover:brightness-110 transition-all font-sans flex items-center gap-1.5">
            <Icon name="fullscreen" size={16} color="#ffffff" />
            Fullscreen
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[500px] bg-surface-container-highest relative overflow-hidden">
        <svg viewBox={NEPAL_MAP_VIEWBOX} className="w-full h-full">
          {PROVINCE_PATHS.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <g key={p.id} className="cursor-pointer" onClick={() => onProvinceClick(p.id)}>
                <path
                  d={p.d}
                  fill={p.fill}
                  opacity={isSelected ? 0.95 : 0.68}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 1.6 : 0.6}
                  className="transition-opacity duration-200 hover:opacity-90"
                />
                <title>{p.name} Province</title>
              </g>
            );
          })}
        </svg>

        {selectedShape && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-4 border border-outline-variant rounded-sm shadow-lg font-sans w-52">
            <h4 className="text-[10px] text-on-surface-variant uppercase mb-2 tracking-widest font-bold">
              {selectedShape.name}
            </h4>
            <div className="space-y-1 text-[12px] text-on-surface">
              {selectedStats?.population != null && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Population</span>
                  <span className="font-bold">{selectedStats.population}</span>
                </div>
              )}
              {selectedStats?.pct != null && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Share of Nepal</span>
                  <span className="font-bold">{selectedStats.pct}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Capital</span>
                <span className="font-bold">{selectedShape.hq}</span>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-4 border border-outline-variant rounded-sm shadow-lg">
          <h4 className="text-[10px] text-on-surface-variant uppercase mb-2 tracking-widest font-bold font-sans">
            Density (p/km²)
          </h4>
          <div className="flex items-center space-x-1">
            <div className="w-8 h-2 bg-surface-container-high rounded-sm" />
            <div className="w-8 h-2 bg-secondary/40 rounded-sm" />
            <div className="w-8 h-2 bg-secondary rounded-sm" />
            <div className="w-8 h-2 bg-primary rounded-sm" />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-on-surface-variant font-bold font-sans">
            <span>0</span>
            <span>500+</span>
          </div>
        </div>
      </div>
    </div>
  );
}