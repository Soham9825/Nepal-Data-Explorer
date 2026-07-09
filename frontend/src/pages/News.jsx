import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Tag } from '../components/ui/Tag';
import { Icon } from '../components/ui/Icon';
import { NEWS_ITEMS } from '../data/dummyData';

export default function News() {
  const [cat, setCat] = useState('All');
  const categories = ['All', 'Economy', 'Tourism', 'Government', 'Finance', 'Agriculture'];
  const filtered = cat === 'All' ? NEWS_ITEMS : NEWS_ITEMS.filter(n => n.category === cat);

  return (
    <DashboardLayout pageTitle="National Headlines">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">National Headlines</h3>
          <p className="text-onSurface-variant text-sm">Economic policy updates, NRB announcements, and sector news</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-2 border font-sans font-bold text-xs cursor-pointer transition-all duration-150 uppercase tracking-[0.04em] ${
                cat === c ? 'bg-secondary text-white border-secondary' : 'bg-white text-onSurface border-outline-variant'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {filtered.map(n => (
            <div
              key={n.id}
              className="bg-surface border border-outline-variant p-5 cursor-pointer transition-colors duration-150 card-shadow hover:border-[n.tagColor]"
              onMouseOver={(e) => (e.currentTarget.style.borderColor = n.tagColor)}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e6bdb8')}
            >
              <div className="flex justify-between items-center mb-3">
                <Tag label={n.tag} color={n.tagColor} bg={n.tagBg} />
                <span className="text-xs text-onSurface-variant">{n.time}</span>
              </div>
              <h4 className="text-sm font-bold text-onSurface leading-relaxed mb-3.5">{n.headline}</h4>
              <button className="bg-none border-none p-0 cursor-pointer text-xs font-bold text-secondary flex items-center gap-1 font-sans uppercase tracking-[0.04em]">
                Read More <Icon name="arrow_forward" size={14} color="#0051d5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}