import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { BtnOutline, BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { API_BASE_URL } from '../config';

const SOURCE_DEFINITIONS = [
  {
    org: 'Nepal Rastra Bank', short: 'NRB', color: '#b70011', frequency: 'Monthly / Annual',
    desc: 'Financial, trade, salary, wholesale price, and macroeconomic datasets available in this project.',
    url: 'https://www.nrb.org.np',
    matches: ['foreigntrade24', 'salaryindex', 'wholesale2'],
  },
  {
    org: 'Central Bureau of Statistics', short: 'CBS', color: '#0051d5', frequency: 'Annual / Quinquennial',
    desc: 'Population, agriculture, and sectoral datasets available in this project.',
    url: 'https://censusnepal.cbs.gov.np',
    matches: ['NR_Indv01', 'agriculture', 'sectoralgrowth'],
  },
  {
    org: 'Department of Tourism', short: 'DoT', color: '#7a5100', frequency: 'Monthly / Annual',
    desc: 'Tourist arrivals, nationalities, purposes, trekking, and tourism datasets.',
    url: 'https://tourism.gov.np',
    matches: ['tourist-', 'trekker', 'tourism_', '12number', '17.'],
  },
  {
    org: 'World Bank Open Data', short: 'WB', color: '#9a6800', frequency: 'Annual',
    desc: 'Global economic series included in the project data collection.',
    url: 'https://data.worldbank.org/country/nepal',
    matches: ['annual_global_economics'],
  },
];

function groupReports(reports) {
  return SOURCE_DEFINITIONS.map((source) => ({
    ...source,
    datasets: reports.filter((report) => {
      const identifier = report.id.toLowerCase();
      return source.matches.some((match) => identifier.includes(match.toLowerCase()));
    }),
  })).filter((source) => source.datasets.length > 0);
}

export default function Research() {
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(null);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/datasets/files/`)
      .then((response) => {
        if (!response.ok) throw new Error(`Research data API error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const sourceFiles = (data.reports || []).filter((report) => report.id.startsWith('datasets__data__'));
        setSources(groupReports(sourceFiles));
      })
      .catch((error) => console.error('Unable to load research datasets:', error));
  }, []);

  const copy = (url, i) => {
    navigator.clipboard?.writeText(url);
    setCopied(i);
    setTimeout(() => setCopied(null), 1800);
  };

  const steps = [
    { step: '01', title: 'Choose a source', body: 'Select the official data source for your research area — NRB for finance, CBS for demographics, DoT for tourism.', icon: 'travel_explore' },
    { step: '02', title: 'Download dataset', body: "Select a dataset below and download the original CSV file used by this project.", icon: 'download' },
    { step: '03', title: 'Cite correctly', body: 'Always cite the original source organization, report title, publication year and URL. Do not cite Nepal Data Explore as a primary source.', icon: 'format_quote' },
  ];

  return (
    <DashboardLayout pageTitle="Research Data Access">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Research Data Access</h3>
          <p className="text-onSurface-variant text-sm max-w-2xl">
            All data used in Nepal Data Explore originates from official government and international sources.
            Download raw datasets directly or use the APIs below for your research projects.
          </p>
        </div>

        <SectionCard title="How to use this data for research" noPad>
          <div className="grid grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className={`p-6 ${i < 2 ? 'border-r border-outline-variant' : ''}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-extrabold text-primary tracking-[0.05em]">{s.step}</span>
                  <Icon name={s.icon} size={18} />
                </div>
                <h4 className="text-sm font-bold text-onSurface mb-1.5">{s.title}</h4>
                <p className="text-sm text-onSurface-variant leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase text-onSurface-variant">Official Data Sources</div>
          {sources.map((src, i) => (
            <div
              key={i}
              className="bg-surface border border-outline-variant p-5 shadow-sm transition-shadow duration-150 hover:shadow-md"
              style={{ borderLeft: `3px solid ${src.color}` }}
            >
              <div className="flex justify-between items-start gap-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-xs font-extrabold text-white px-2 py-0.5" style={{ background: src.color }}>
                      {src.short}
                    </span>
                    <span className="text-sm font-bold text-onSurface">{src.org}</span>
                    <span className="text-xs text-onSurface-variant bg-surface-highest px-2 py-0.5 border border-outline-variant font-semibold">
                      {src.frequency}
                    </span>
                  </div>
                  <p className="text-sm text-onSurface-variant leading-relaxed mb-3">{src.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {src.datasets.slice(0, 3).map((d) => (
                      <span key={d.id} className="text-xs font-semibold text-onSurface-variant bg-surface-highest px-2.5 py-0.5 border border-outline-variant">
                        {d.title}
                      </span>
                    ))}
                    {src.datasets.length > 3 && (
                      <span className="text-xs text-onSurface-variant px-2 py-0.5">+{src.datasets.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold flex items-center gap-1 no-underline" style={{ color: src.color }}>
                    <Icon name="open_in_new" size={14} color={src.color} />
                    Visit {src.short}
                  </a>
                  <BtnOutline onClick={() => copy(src.url, i)} className="text-xs px-2.5 py-1 gap-0.5">
                    <Icon name={copied === i ? 'check' : 'content_copy'} size={13} />
                    {copied === i ? 'Copied!' : 'Copy URL'}
                  </BtnOutline>
                  <BtnOutline onClick={() => setExpanded(expanded === i ? null : i)} className="text-xs px-2.5 py-1 gap-0.5">
                    <Icon name={expanded === i ? 'expand_less' : 'expand_more'} size={13} />
                    {expanded === i ? 'Hide' : 'All datasets'}
                  </BtnOutline>
                </div>
              </div>
              {expanded === i && (
                <div className="mt-4 pt-4 border-t border-outline-variant">
                  <div className="text-xs font-bold uppercase text-onSurface-variant mb-2.5">Available Datasets</div>
                  <div className="grid grid-cols-2 gap-2">
                    {src.datasets.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3.5 py-2.5 bg-surface-lowest border border-outline-variant">
                        <div className="flex items-center gap-2">
                          <Icon name="table_chart" size={16} color={src.color} />
                          <span className="text-sm font-semibold text-onSurface">{d.title}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <BtnOutline className="px-2 py-0.5 text-[10px] gap-0.5" onClick={() => window.open(`${API_BASE_URL}${d.download_url}`, '_blank', 'noopener,noreferrer')}>
                            <Icon name="download" size={11} /> CSV · {d.size}
                          </BtnOutline>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-surface border border-outline-variant p-5 flex items-center gap-4 card-shadow">
          <Icon name="api" size={32} color="#0051d5" />
          <div className="flex-1">
            <div className="text-sm font-bold text-onSurface">Need machine-readable data?</div>
            <div className="text-sm text-onSurface-variant mt-0.5">
              World Bank publishes a free REST API for Nepal.
              Example: <code className="bg-surface-highest px-1.5 py-0.5 text-xs">https://api.worldbank.org/v2/country/NPL/indicator/NY.GDP.MKTP.CD</code>
            </div>
          </div>
          <a href="https://data.worldbank.org/country/nepal" target="_blank" rel="noopener noreferrer">
            <BtnPrimary>Explore API →</BtnPrimary>
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}