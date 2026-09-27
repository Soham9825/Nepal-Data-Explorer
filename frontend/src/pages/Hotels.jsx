import { useState } from 'react';
import { TabBtn } from '../components/ui/Tabs';
import HotelSearchTab from '../components/hotels/HotelSearchTab';
import HotelSourcesTab from '../components/hotels/HotelSourcesTab';

const TABS = [
  { id: 'search', label: 'Search Hotels' },
  { id: 'sources', label: 'Data Sources' },
];

export default function Hotels() {
  const [tab, setTab] = useState('search');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-hanken text-2xl font-bold text-onSurface">Hotel Intelligence</h1>
        <p className="mt-1 max-w-3xl font-hanken text-sm text-onSurface-variant">
          Search hotels across Nepal using mapped hotel data and scraped price observations, with transparent source provenance.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <TabBtn key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </TabBtn>
        ))}
      </div>
      {tab === 'search' && <HotelSearchTab />}
      {tab === 'sources' && <HotelSourcesTab />}
    </div>
  );
}
