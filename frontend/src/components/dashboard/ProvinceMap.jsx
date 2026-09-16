import { useState } from 'react';

const provinces = [
  { cx: 90, cy: 200, rx: 80, ry: 55, name: 'Sudurpashchim', id: 7, fill: '#7a5100' },
  { cx: 190, cy: 185, rx: 75, ry: 60, name: 'Karnali', id: 6, fill: '#5c403c' },
  { cx: 300, cy: 175, rx: 80, ry: 65, name: 'Lumbini', id: 5, fill: '#0051d5' },
  { cx: 410, cy: 165, rx: 70, ry: 70, name: 'Gandaki', id: 4, fill: '#316bf3' },
  { cx: 520, cy: 155, rx: 85, ry: 75, name: 'Bagmati', id: 3, fill: '#b70011' },
  { cx: 645, cy: 175, rx: 95, ry: 60, name: 'Madhesh', id: 2, fill: '#dc2626' },
  { cx: 765, cy: 170, rx: 50, ry: 65, name: 'Koshi', id: 1, fill: '#9a6800' },
];

export default function ProvinceMap({ onProvinceSelect, selectedProvince }) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <div className={`bg-surface border border-outline-variant rounded-sm overflow-hidden flex flex-col relative card-shadow ${
      showFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <div>
          <h3 className="font-bold text-on-surface text-xl font-sans">
            Provincial Population Density
          </h3>
          <p className="text-on-surface-variant text-[12px] font-sans">
            Geographic distribution based on 2021 Census data
          </p>
          {selectedProvince && (
            <p className="text-xs text-primary font-bold mt-1">
              Selected: {selectedProvince.name} Province
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <button className="bg-surface border border-outline-variant px-4 py-1.5 rounded-sm text-[12px] text-on-surface hover:bg-surface-container-highest font-bold font-sans">
            Filter
          </button>
          <button 
            onClick={() => setShowFullscreen(!showFullscreen)}
            className="bg-primary-container text-on-primary px-4 py-1.5 rounded-sm text-[12px] font-bold shadow-sm hover:brightness-110 transition-all font-sans"
          >
            {showFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[500px] bg-surface-container-highest relative overflow-hidden cursor-crosshair">
        <svg viewBox="0 0 820 380" className="w-full h-full">
          {provinces.map((p) => {
            const isSelected = selectedProvince?.id === p.id;
            return (
              <g 
                key={p.id} 
                className="cursor-pointer transition-all duration-200"
                onClick={() => onProvinceSelect(p.id)}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <ellipse
                  cx={p.cx}
                  cy={p.cy}
                  rx={p.rx}
                  ry={p.ry}
                  fill={p.fill}
                  opacity={isSelected ? '0.9' : '0.62'}
                  stroke="#fff"
                  strokeWidth={isSelected ? '4' : '2'}
                  className="transition-all duration-200"
                />
                {isSelected && (
                  <ellipse
                    cx={p.cx}
                    cy={p.cy}
                    rx={p.rx + 8}
                    ry={p.ry + 8}
                    fill="none"
                    stroke="#b70011"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    opacity="0.7"
                  />
                )}
                <text
                  x={p.cx}
                  y={p.cy - 4}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="11"
                  fontWeight="700"
                  className="font-sans pointer-events-none"
                >
                  {p.name}
                </text>
                <text
                  x={p.cx}
                  y={p.cy + 12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.8)"
                  fontSize="9"
                  className="font-sans pointer-events-none"
                >
                  P{p.id}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-4 border border-outline-variant rounded-sm shadow-lg">
          <h4 className="text-[10px] text-on-surface-variant uppercase mb-2 tracking-widest font-bold font-sans">
            Density (p/km²)
          </h4>
          <div className="flex items-center space-x-1">
            <div className="w-8 h-2 bg-surface-container-high" />
            <div className="w-8 h-2 bg-secondary/40" />
            <div className="w-8 h-2 bg-secondary" />
            <div className="w-8 h-2 bg-primary" />
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