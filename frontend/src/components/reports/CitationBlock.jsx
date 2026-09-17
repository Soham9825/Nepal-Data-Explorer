
import { SectionCard } from '../ui/Card';

const citations = [
  { style: 'APA 7th', ex: 'Central Bureau of Statistics. (2021). National Population and Housing Census 2021. Government of Nepal. https://censusnepal.cbs.gov.np' },
  { style: 'MLA 9th', ex: 'Central Bureau of Statistics. "National Population and Housing Census 2021." Government of Nepal, 2021, censusnepal.cbs.gov.np.' },
];

export default function CitationBlock() {
  return (
    <SectionCard title="Citation Format" subtitle="Use these when citing Nepal Data Explore data in academic work">
      <div className="grid grid-cols-2 gap-5">
        {citations.map((c) => (
          <div key={c.style}>
            <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">{c.style}</div>
            <div className="bg-surface-lowest border border-outline-variant p-3 text-xs text-onSurface leading-relaxed" style={{ borderLeft: '3px solid #b70011' }}>
              {c.ex}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}