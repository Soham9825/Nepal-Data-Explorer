// ─── METRICS ──────────────────────────────────────────────
export const nationalMetrics = [
  {
    id: 1,
    label: 'Total Population',
    value: '29,164,578',
    change: '+0.92%',
    trend: 'up',
    subtitle: 'vs 2011 Census',
    icon: 'groups',
    color: '#0051d5',
  },
  {
    id: 2,
    label: 'GDP Growth Rate',
    value: '1.9%',
    change: '−0.4%',
    trend: 'down',
    subtitle: 'FY 2022/23 Estimate',
    icon: 'trending_up',
    color: '#0051d5',
  },
  {
    id: 3,
    label: 'Literacy Rate',
    value: '76.2%',
    change: '+10.3%',
    trend: 'up',
    subtitle: 'Increase since 2011',
    icon: 'auto_stories',
    color: '#7a5100',
  },
  {
    id: 4,
    label: 'National Health Index',
    value: '64.8',
    change: '+2.1',
    trend: 'up',
    subtitle: 'Composite Score',
    icon: 'health_metrics',
    color: '#0051d5',
  },
];

// ─── NEWS ──────────────────────────────────────────────────
export const NEWS_ITEMS = [
  {
    id: 1,
    tag: 'NRB Update',
    tagColor: '#0051d5',
    tagBg: '#dbe1ff',
    time: '2 hours ago',
    headline: 'Central Bank releases mid-term monetary policy review for FY 2023/24, signals cautious easing.',
    category: 'Finance',
  },
  {
    id: 2,
    tag: 'Education',
    tagColor: '#7a5100',
    tagBg: '#ffddb0',
    time: '5 hours ago',
    headline: 'National Education Strategy 2030: Literacy goals expanded for rural districts in Karnali and Sudurpashchim.',
    category: 'Government',
  },
  {
    id: 3,
    tag: 'Agriculture',
    tagColor: '#b70011',
    tagBg: '#ffdad6',
    time: 'Yesterday',
    headline: 'Paddy production forecasts rise 8% despite late monsoon onset in Terai belt this season.',
    category: 'Agriculture',
  },
  {
    id: 4,
    tag: 'Tourism',
    tagColor: '#0051d5',
    tagBg: '#dbe1ff',
    time: '2 days ago',
    headline: 'Tourist arrivals on track to exceed 1 million mark for FY 2023/24 as Himalayan trekking surges.',
    category: 'Tourism',
  },
  {
    id: 5,
    tag: 'Finance',
    tagColor: '#7a5100',
    tagBg: '#ffddb0',
    time: '3 days ago',
    headline: 'Remittance inflows grow 12.8% year-on-year, providing critical support to balance of payments.',
    category: 'Economy',
  },
  {
    id: 6,
    tag: 'Government',
    tagColor: '#5c403c',
    tagBg: '#f0f0f0',
    time: '4 days ago',
    headline: 'Nepal ranked 98th in World Bank Ease of Doing Business index — up 12 places from last year.',
    category: 'Government',
  },
  {
    id: 7,
    tag: 'Economy',
    tagColor: '#b70011',
    tagBg: '#ffdad6',
    time: '5 days ago',
    headline: 'Trade deficit narrows slightly as fuel imports decline and hydropower exports begin to scale.',
    category: 'Economy',
  },
  {
    id: 8,
    tag: 'Tourism',
    tagColor: '#0051d5',
    tagBg: '#dbe1ff',
    time: '1 week ago',
    headline: 'Everest Base Camp trekking permits hit record high in autumn 2023 season — DoT data confirms.',
    category: 'Tourism',
  },
];

export const nationalNews = NEWS_ITEMS;

// ─── GDP DATA ─────────────────────────────────────────────
export const GDP_DATA = [
  { year: '2019', value: 7.1, gdp: 29.0, inflation: 4.6, exports: 9.0, imports: 26.1, tourism: 1197 },
  { year: '2020', value: -2.3, gdp: 28.7, inflation: 6.1, exports: 7.9, imports: 21.0, tourism: 230 },
  { year: '2021', value: 4.2, gdp: 29.8, inflation: 3.6, exports: 9.2, imports: 22.8, tourism: 150 },
  { year: '2022', value: 5.8, gdp: 33.9, inflation: 6.3, exports: 10.1, imports: 28.5, tourism: 616 },
  { year: '2023', value: 1.9, gdp: 36.1, inflation: 7.8, exports: 11.3, imports: 29.2, tourism: 1006 },
];

export const gdpTrend = GDP_DATA.map(d => ({ year: d.year, value: d.value }));

// ─── FORECAST DATA ────────────────────────────────────────
export const FORECAST_DATA = [
  { year: '2024', gdp: 38.2, inflation: 5.9, tourism: 1180, low: 37.0, high: 39.4 },
  { year: '2025', gdp: 40.5, inflation: 5.1, tourism: 1340, low: 38.5, high: 42.5 },
  { year: '2026', gdp: 43.1, inflation: 4.6, tourism: 1510, low: 40.2, high: 46.0 },
  { year: '2027', gdp: 45.8, inflation: 4.2, tourism: 1690, low: 43.0, high: 48.6 },
];

// ─── PROVINCES ─────────────────────────────────────────────
export const PROVINCES = [
  { id: 1, name: 'Koshi', pop: 4967388, pct: 17.1, gdp: 4.2, employment: 67, literacy: 74, tourism: 320, agriculture: 38 },
  { id: 2, name: 'Madhesh', pop: 6114600, pct: 21.0, gdp: 3.8, employment: 61, literacy: 63, tourism: 85, agriculture: 52 },
  { id: 3, name: 'Bagmati', pop: 6116866, pct: 21.0, gdp: 12.4, employment: 72, literacy: 82, tourism: 480, agriculture: 18 },
  { id: 4, name: 'Gandaki', pop: 2403757, pct: 8.2, gdp: 3.5, employment: 65, literacy: 76, tourism: 210, agriculture: 41 },
  { id: 5, name: 'Lumbini', pop: 5122078, pct: 17.5, gdp: 5.1, employment: 63, literacy: 68, tourism: 145, agriculture: 47 },
  { id: 6, name: 'Karnali', pop: 1694889, pct: 5.8, gdp: 1.9, employment: 58, literacy: 58, tourism: 42, agriculture: 61 },
  { id: 7, name: 'Sudurpashchim', pop: 2711270, pct: 9.3, gdp: 2.3, employment: 59, literacy: 61, tourism: 38, agriculture: 56 },
];

export const PROV_COLORS = ['#b70011', '#0051d5', '#7a5100', '#316bf3', '#9a6800', '#5c403c', '#dc2626'];

export const provincePopulation = PROVINCES.map(p => ({
  name: p.name,
  population: p.pop.toLocaleString(),
  pct: p.pct,
  color: PROV_COLORS[p.id - 1],
}));

// ─── ECONOMIC DISTRIBUTION ───────────────────────────────
export const ECON_DIST = [
  { name: 'Services', value: 51, color: '#0051d5' },
  { name: 'Agriculture', value: 26, color: '#7a5100' },
  { name: 'Industry', value: 14, color: '#b70011' },
  { name: 'Tourism', value: 9, color: '#316bf3' },
];

// ─── TOURISM ───────────────────────────────────────────────
export const TOURISM_ITEMS = [
  { icon: 'filter_hdr', label: 'Everest Region', arrivals: '320K', pct: 31.8, color: '#b70011', trend: '+18%' },
  { icon: 'temple_buddhist', label: 'Lumbini (Buddha Birthplace)', arrivals: '195K', pct: 19.4, color: '#7a5100', trend: '+24%' },
  { icon: 'landscape', label: 'Annapurna Circuit', arrivals: '210K', pct: 20.9, color: '#0051d5', trend: '+12%' },
  { icon: 'water', label: 'Phewa Lake / Pokhara', arrivals: '180K', pct: 17.9, color: '#316bf3', trend: '+9%' },
  { icon: 'forest', label: 'Chitwan Nat. Park', arrivals: '101K', pct: 10.0, color: '#22C55E', trend: '+15%' },
];

export const TOURISM_STATS = [
  { label: 'Total Arrivals 2023', value: '1,006K', change: '+63.2%', up: true, sub: 'vs 2022 (616K)', icon: 'flight_land' },
  { label: 'Forex Earnings', value: '$734M', change: '+58.4%', up: true, sub: 'USD, FY 2022/23', icon: 'payments' },
  { label: 'Avg Stay (nights)', value: '12.4', change: '+1.1', up: true, sub: 'vs 11.3 in 2022', icon: 'hotel' },
  { label: 'Trekking Permits', value: '148K', change: '+71%', up: true, sub: 'DoT, FY 2022/23', icon: 'hiking' },
];

// ─── AI INSIGHTS ──────────────────────────────────────────
export const AI_INSIGHTS = [
  {
    text: 'GDP growth is projected to recover to 5.4% in FY2025 driven by hydropower exports and services expansion.',
    confidence: 87,
    type: 'positive',
  },
  {
    text: 'Inflation expected to moderate below 5% as import costs normalize following NRB monetary tightening.',
    confidence: 79,
    type: 'positive',
  },
  {
    text: 'Tourist arrivals forecasted to grow 12–18% YoY through 2026 if Pokhara airport reaches full capacity.',
    confidence: 73,
    type: 'positive',
  },
  {
    text: 'Trade deficit remains a structural concern; export diversification shows early but fragile positive signals.',
    confidence: 61,
    type: 'warning',
  },
];

// ─── RESEARCH SOURCES ─────────────────────────────────────
export const RESEARCH_SOURCES = [
  {
    org: 'Nepal Rastra Bank',
    short: 'NRB',
    color: '#b70011',
    desc: 'Monetary policy, banking & financial statistics, forex reserves, balance of payments',
    url: 'https://www.nrb.org.np',
    frequency: 'Monthly / Annual',
    datasets: [
      'Monetary Policy Reports',
      'Banking & Financial Statistics',
      'Balance of Payments',
      'Consumer Price Index',
      'Forex Reserve Data',
    ],
  },
  {
    org: 'Central Bureau of Statistics',
    short: 'CBS',
    color: '#0051d5',
    desc: 'Population census, national accounts, household surveys, living standards measurement',
    url: 'https://censusnepal.cbs.gov.np',
    frequency: 'Annual / Quinquennial',
    datasets: [
      'Census 2021 Microdata',
      'National Accounts (GDP)',
      'Nepal Living Standards Survey',
      'Agricultural Census',
      'District Level Data',
    ],
  },
  {
    org: 'Department of Tourism',
    short: 'DoT',
    color: '#7a5100',
    desc: 'Tourist arrivals by country, trekking permits, mountaineering data, hotel occupancy rates',
    url: 'https://tourism.gov.np',
    frequency: 'Monthly / Annual',
    datasets: [
      'Annual Tourism Statistics',
      'Trekking Area Permits',
      'Mountaineering Data',
      'Hotel Survey Report',
      'Foreign Exchange Earnings',
    ],
  },
  {
    org: 'Ministry of Finance',
    short: 'MoF',
    color: '#316bf3',
    desc: 'National budget, fiscal policy, development expenditure, public debt management',
    url: 'https://mof.gov.np',
    frequency: 'Annual',
    datasets: [
      'Budget Red Book',
      'Economic Survey',
      'Public Debt Bulletin',
      'Development Expenditure Review',
      'Revenue Projection Report',
    ],
  },
  {
    org: 'World Bank Open Data',
    short: 'WB',
    color: '#9a6800',
    desc: 'Long-run development indicators for Nepal — poverty, education, health, GDP per capita',
    url: 'https://data.worldbank.org/country/nepal',
    frequency: 'Annual',
    datasets: [
      'GDP & Growth Series',
      'Poverty Headcount Data',
      'Education Indicators',
      'Health Statistics',
      'Trade & External Debt',
    ],
  },
];