import { useState, useEffect } from 'react';
import { SectionCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { ProgressBar } from '../components/ui/ProgressBar';
import { BtnOutline } from '../components/ui/Button';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DataFooter from '../components/common/DataFooter';
import Loader from '../components/common/Loader';
import { formatCountryName, getCountryFlag } from '../utils/countryFlags';

import { tourismAPI } from '../services/tourismAPI';
import { downloadTourismReport } from '../services/reportApi';

const TABS = [
  { id: 'arrivals', label: 'Tourist Arrivals Trend' },
  { id: 'source-markets', label: 'Top Source Markets' },
  { id: 'revenue', label: 'Revenue Trend' },
  { id: 'stay', label: 'Avg. Length of Stay' },
  { id: 'purpose', label: 'Purpose of Visit' },
  { id: 'trekking', label: 'Trekking Areas & Trekkers' },
  { id: 'sex', label: 'Arrivals by Sex' },
  { id: 'age', label: 'Arrivals by Age Group' },
  { id: 'province', label: 'Tourism by Province' },
];
const SECTION_ROWS = [
  ['arrivals', 'revenue'],
  ['source-markets'],
  ['stay', 'purpose'],
  ['trekking', 'sex'],
  ['age'],
  ['province'],
];
const SOURCE_MARKET_COLORS = [
  '#7a5100',
  '#0051d5',
  '#0f7a3d',
  '#b70011',
  '#6a1b9a',
  '#007c91',
  '#c2410c',
  '#5c403c',
  '#2563eb',
  '#15803d',
];
const PROVINCE_COLORS = [
  '#7a5100',
  '#0051d5',
  '#0f7a3d',
  '#b70011',
  '#6a1b9a',
  '#007c91',
  '#c2410c',
];
const CHART_HEIGHT = 'h-80';

function ChartBox({ children }) {
  return (
    <div
      className={`${CHART_HEIGHT} min-h-0 rounded-sm border border-outline-variant bg-surface p-1`}
    >
      {children}
    </div>
  );
}

function SideList({ title, count, items }) {
  return (
    <div
      className={`${CHART_HEIGHT} flex flex-col rounded-sm border border-outline-variant bg-surface`}
    >
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h4 className="text-sm font-bold text-onSurface font-hanken">{title}</h4>
        {count != null && (
          <span className="rounded-sm bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant font-hanken">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-onSurface font-hanken">
                  {item.label}
                </span>
                <div className="mt-1">
                  <ProgressBar value={item.pct} color={item.color} total={100} />
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums text-onSurface font-hanken">
                {item.value}
              </span>
              <span className="w-14 text-right text-xs font-bold tabular-nums text-onSurface-variant">
                {item.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TwoColumn({ left, right }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 min-h-0">{left}</div>
      <div className="lg:col-span-1 min-h-0">{right}</div>
    </div>
  );
}

export default function Tourism() {
  const [activeTab, setActiveTab] = useState('arrivals');
  const [arrivalRange, setArrivalRange] = useState('all');
  const [revenueRange, setRevenueRange] = useState('all');
  const [stayRange, setStayRange] = useState('all');
  const [purposeYear, setPurposeYear] = useState('');
  const [trekkingYear, setTrekkingYear] = useState('');
  const [ageYear, setAgeYear] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [showAllSourceMarkets, setShowAllSourceMarkets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tourismData, setTourismData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await tourismAPI.getDashboardData();
        if (!mounted) return;
        setTourismData(data);
      } catch (err) {
        console.error('Could not load tourism data', err);
        if (mounted) setError('Tourism data could not be loaded from the database.');
        setTourismData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(`tourism-${id}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const arrivalTrend = tourismData?.arrival_trend || [];
  const visibleArrivalTrend =
    arrivalRange === 'all' ? arrivalTrend : arrivalTrend.slice(-Number(arrivalRange));
  const sourceMarketYear = arrivalTrend.at(-1)?.year;
  const sourceMarkets = (tourismData?.nationality_trend || [])
    .filter(
      (record) =>
        record.year === sourceMarketYear &&
        record.arrivals !== null &&
        record.arrivals !== undefined
    )
    .sort((first, second) => second.arrivals - first.arrivals);
  const visibleSourceMarkets = showAllSourceMarkets ? sourceMarkets : sourceMarkets.slice(0, 10);
  const revenueTrend = (tourismData?.revenue || []).filter(
    (record) =>
      record.metric === 'US$_Million' && record.value !== null && record.value !== undefined
  );
  const visibleRevenueTrend =
    revenueRange === 'all' ? revenueTrend : revenueTrend.slice(-Number(revenueRange));
  const avgStayTrend = tourismData?.avg_stay_trend || [];
  const visibleAvgStay =
    stayRange === 'all' ? avgStayTrend : avgStayTrend.slice(-Number(stayRange));
  const purposeTrend = tourismData?.purpose_trend || [];
  const purposeYears = [...new Set(purposeTrend.map((row) => String(row.year)))].sort(
    (a, b) => Number(a) - Number(b)
  );
  const selectedPurposeYear = purposeYears.includes(purposeYear)
    ? purposeYear
    : purposeYears.at(-1) || '';
  const visiblePurpose = purposeTrend
    .filter((row) => String(row.year) === selectedPurposeYear && Number(row.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  const trekkingTrend = tourismData?.trekking_trend || [];
  const trekkingYears = [...new Set(trekkingTrend.map((row) => String(row.year)))].sort(
    (a, b) => Number(a) - Number(b)
  );
  const selectedTrekkingYear = trekkingYears.includes(trekkingYear)
    ? trekkingYear
    : trekkingYears.at(-1) || '';
  const visibleTrekking = trekkingTrend
    .filter((row) => String(row.year) === selectedTrekkingYear && Number(row.trekkers) > 0)
    .sort((a, b) => Number(b.trekkers) - Number(a.trekkers));
  const allSexTrend = tourismData?.sex_trend || [];
  const sexTrend = allSexTrend.filter(
    (record) => (record.statistic_type || '').toLowerCase() === 'number'
  );
  const sexDataByYear = {};
  sexTrend.forEach((record) => {
    if (!sexDataByYear[record.year]) sexDataByYear[record.year] = { year: record.year };
    const genderKey = (record.gender || '').toLowerCase() === 'female' ? 'female' : 'male';
    sexDataByYear[record.year][genderKey] = Number(record.value);
  });
  const visibleSex = Object.values(sexDataByYear).sort((a, b) => a.year - b.year);
  const sexYears = visibleSex.map((record) => String(record.year));
  const selectedSexYear = sexYears.at(-1) || '';
  const ageTrend = tourismData?.age_trend || [];
  const ageYears = [...new Set(ageTrend.map((row) => String(row.year)))].sort(
    (a, b) => Number(a) - Number(b)
  );
  const selectedAgeYear = ageYears.includes(ageYear) ? ageYear : ageYears.at(-1) || '';
  const visibleAge = ageTrend
    .filter((row) => String(row.year) === selectedAgeYear && Number(row.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  const kpis = tourismData?.kpis;
  const latestRevenue = revenueTrend.at(-1);
  const maxSourceArrivals = Math.max(...sourceMarkets.map((market) => market.arrivals), 0);

  const provinceTourism = tourismData?.province_tourism || {};
  const provinceLatestYear = provinceTourism.latest_year;
  const provinces = (provinceTourism.latest || []).map((item) => item.province);
  const activeProvince = provinces.includes(selectedProvince)
    ? selectedProvince
    : provinces[0] || '';
  const provinceByYear = (provinceTourism.by_year || []).filter(
    (record) => record.province === activeProvince
  );
  const activeProvinceLatest = (provinceTourism.latest || []).find(
    (item) => item.province === activeProvince
  );
  const activeDestinations = (activeProvinceLatest?.destinations || [])
    .slice()
    .sort((a, b) => Number(b.visitors) - Number(a.visitors));

  const sectionSubtitle = (id) => {
    if (id === 'arrivals' && visibleArrivalTrend.length)
      return `Annual arrivals (${visibleArrivalTrend[0].year}–${visibleArrivalTrend.at(-1).year})`;
    if (id === 'source-markets')
      return sourceMarketYear ? `Annual arrivals by nationality (${sourceMarketYear})` : 'Annual arrivals by nationality';
    if (id === 'revenue' && visibleRevenueTrend.length)
      return `Tourism revenue (US$ millions) (${visibleRevenueTrend[0].fiscal_year}–${visibleRevenueTrend.at(-1).fiscal_year})`;
    if (id === 'stay' && visibleAvgStay.length)
      return `Average length of stay in days (${visibleAvgStay[0].year}–${visibleAvgStay.at(-1).year})`;
    if (id === 'purpose' && visiblePurpose.length)
      return `Arrivals by purpose of visit (${selectedPurposeYear})`;
    if (id === 'trekking' && visibleTrekking.length)
      return `Trekkers by trekking area (${selectedTrekkingYear})`;
    if (id === 'sex' && visibleSex.length)
      return `Arrivals by gender (${visibleSex[0].year}–${visibleSex.at(-1).year})`;
    if (id === 'age' && visibleAge.length) return `Arrivals by age group (${selectedAgeYear})`;
    if (id === 'province')
      return provinceLatestYear
        ? `Official visits by province (${provinceLatestYear}) · Nepal Tourism Statistics`
        : 'Official destination visits by province';
    return 'Tourism statistics';
  };

  const sectionAction = (id) => {
    if (id === 'arrivals' || id === 'revenue' || id === 'stay') {
      const selectedRange =
        id === 'arrivals' ? arrivalRange : id === 'stay' ? stayRange : revenueRange;
      const applyRange =
        id === 'arrivals' ? setArrivalRange : id === 'stay' ? setStayRange : setRevenueRange;
      return (
        <div className="flex items-center gap-1 rounded-sm border border-outline-variant bg-white p-1">
          {[
            ['all', 'All'],
            ['10', '10 years'],
            ['5', '5 years'],
          ].map(([rangeId, label]) => (
            <button
              key={rangeId}
              onClick={() => applyRange(rangeId)}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${selectedRange === rangeId ? 'bg-primary text-white' : 'text-onSurface-variant hover:bg-surface-container-highest'}`}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }
    if (id === 'purpose' && purposeYears.length > 1) {
      return (
        <select
          value={selectedPurposeYear}
          onChange={(event) => setPurposeYear(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {purposeYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }
    if (id === 'trekking' && trekkingYears.length > 1) {
      return (
        <select
          value={selectedTrekkingYear}
          onChange={(event) => setTrekkingYear(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {trekkingYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }
    if (id === 'age' && ageYears.length > 1) {
      return (
        <select
          value={selectedAgeYear}
          onChange={(event) => setAgeYear(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {ageYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }
    if (id === 'province' && provinces.length > 1) {
      return (
        <select
          value={activeProvince}
          onChange={(event) => setSelectedProvince(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      );
    }
    if (id === 'source-markets') {
      return (
        <BtnOutline
          onClick={() => setShowAllSourceMarkets((value) => !value)}
          className="text-xs px-4 py-1.5 rounded-sm font-hanken"
        >
          {showAllSourceMarkets ? 'Show top 10' : `View all (${sourceMarkets.length})`}
        </BtnOutline>
      );
    }
    return null;
  };

  const renderSectionContent = (id) => {
    if (id === 'arrivals') {
      return (
        <ChartBox>
          <LineChart
            data={visibleArrivalTrend.map((record) => ({
              year: record.year,
              tourism: record.total_arrivals,
            }))}
            xKey="year"
            series={[{ key: 'tourism', color: '#7a5100', label: 'Arrivals' }]}
            height="100%"
          />
        </ChartBox>
      );
    }
    if (id === 'source-markets') {
      return (
        <TwoColumn
          left={
            <ChartBox>
              <BarChart
                data={visibleSourceMarkets.map((market, index) => ({
                  name: market.nationality,
                  arrivals: market.arrivals,
                  color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
                }))}
                labelKey="name"
                valueKey="arrivals"
                tooltipFormatter={formatCountryName}
                height="100%"
                bordered={false}
              />
            </ChartBox>
          }
          right={
            <SideList
              title="Top source markets"
              count={sourceMarkets.length}
              items={sourceMarkets.map((market, index) => ({
                label: `${getCountryFlag(market.nationality)} ${formatCountryName(
                  market.nationality
                )}`,
                value: Number(market.arrivals).toLocaleString(),
                pct:
                  market.percent ??
                  (maxSourceArrivals ? (market.arrivals / maxSourceArrivals) * 100 : 0),
                color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
              }))}
            />
          }
        />
      );
    }
    if (id === 'revenue') {
      return (
        <ChartBox>
          <LineChart
            data={visibleRevenueTrend.map((record) => ({
              year: record.fiscal_year,
              revenue: record.value,
            }))}
            xKey="year"
            series={[{ key: 'revenue', color: '#b70011', label: 'Revenue (US$ millions)' }]}
            height="100%"
          />
        </ChartBox>
      );
    }
    if (id === 'stay') {
      return (
        <ChartBox>
          <LineChart
            data={visibleAvgStay.map((record) => ({
              year: record.year,
              stay: record.value,
            }))}
            xKey="year"
            series={[{ key: 'stay', color: '#0f7a3d', label: 'Avg. stay (days)' }]}
            height="100%"
          />
        </ChartBox>
      );
    }
    if (id === 'purpose') {
      return (
        <ChartBox>
          <BarChart
            data={visiblePurpose.map((record, index) => ({
              name: record.category,
              arrivals: record.value,
              color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
            }))}
            labelKey="name"
            valueKey="arrivals"
            height="100%"
            bordered={false}
          />
        </ChartBox>
      );
    }
    if (id === 'trekking') {
      return (
        <ChartBox>
          <BarChart
            data={visibleTrekking.map((record, index) => ({
              name: record.region,
              trekkers: record.trekkers,
              color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
            }))}
            labelKey="name"
            valueKey="trekkers"
            height="100%"
            bordered={false}
          />
        </ChartBox>
      );
    }
    if (id === 'sex') {
      return (
        <ChartBox>
          <LineChart
            data={visibleSex}
            xKey="year"
            series={[
              { key: 'female', color: '#b70011', label: 'Female' },
              { key: 'male', color: '#0051d5', label: 'Male' },
            ]}
            height="100%"
          />
        </ChartBox>
      );
    }
    if (id === 'age') {
      const ageTotal = visibleAge.reduce(
        (sum, record) => sum + (Number(record.value) || 0),
        0
      );
      return (
        <TwoColumn
          left={
            <ChartBox>
              <BarChart
                data={visibleAge.map((record, index) => ({
                  name: record.age_group,
                  arrivals: record.value,
                  color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
                }))}
                labelKey="name"
                valueKey="arrivals"
                height="100%"
                bordered={false}
              />
            </ChartBox>
          }
          right={
            <SideList
              title={`Age group breakdown · ${selectedAgeYear}`}
              count={visibleAge.length}
              items={visibleAge.map((record, index) => ({
                label: record.age_group,
                value: Number(record.value || 0).toLocaleString(),
                pct: ageTotal ? (Number(record.value) / ageTotal) * 100 : 0,
                color: SOURCE_MARKET_COLORS[index % SOURCE_MARKET_COLORS.length],
              }))}
            />
          }
        />
      );
    }
    if (id === 'province') {
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="flex h-72 flex-col">
              <div className="mb-2 shrink-0 text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">
                Official visits by province {provinceLatestYear ? `(${provinceLatestYear})` : ''}
              </div>
              <div className="min-h-0 flex-1 rounded-sm border border-outline-variant bg-surface p-1">
                <BarChart
                  data={(provinceTourism.latest || []).map((item, index) => ({
                    name: item.province,
                    visitors: item.visitors,
                    color: PROVINCE_COLORS[index % PROVINCE_COLORS.length],
                  }))}
                  labelKey="name"
                  valueKey="visitors"
                  height="100%"
                  bordered={false}
                />
              </div>
            </div>
            <div className="flex h-72 flex-col">
              <div className="mb-2 shrink-0 text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">
                {activeProvince} visits by year
              </div>
              <div className="min-h-0 flex-1 rounded-sm border border-outline-variant bg-surface p-1">
                <LineChart
                  data={provinceByYear.map((record) => ({ year: record.year, visitors: record.visitors }))}
                  xKey="year"
                  series={[{ key: 'visitors', color: '#6a1b9a', label: 'Visitors' }]}
                  height="100%"
                />
              </div>
            </div>
          </div>
          {activeDestinations.length > 0 && (
            <div className="mt-3 rounded-sm border border-outline-variant bg-surface-lowest p-4">
              <h4 className="mb-3 text-sm font-bold text-onSurface font-hanken">
                Official destinations · {activeProvince}{' '}
                {provinceLatestYear ? `(${provinceLatestYear})` : ''}
              </h4>
              <div className="max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                <div className="space-y-3">
                  {activeDestinations.map((dest) => (
                    <div key={dest.name} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-onSurface font-hanken truncate">
                          {dest.name}
                        </span>
                        <div className="mt-1">
                          <ProgressBar value={dest.share} color="#6a1b9a" total={100} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-onSurface font-hanken">
                        {dest.visitors}
                      </span>
                      <span className="w-16 text-right text-xs font-bold tabular-nums text-onSurface-variant">
                        {dest.share.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const csvData = [
    {
      Dataset: 'Key indicators',
      Indicator: 'Total Tourists',
      Value: kpis?.total_tourists != null ? Number(kpis.total_tourists).toLocaleString() : '—',
      Period: sourceMarketYear || '',
    },
    {
      Dataset: 'Key indicators',
      Indicator: 'Growth %',
      Value: kpis?.growth_percent != null ? `${kpis.growth_percent}%` : '—',
      Period: sourceMarketYear || '',
    },
    {
      Dataset: 'Key indicators',
      Indicator: 'Top Source Market',
      Value: kpis?.top_source_country?.nationality
        ? formatCountryName(kpis.top_source_country.nationality)
        : '—',
      Period: sourceMarketYear || '',
    },
    {
      Dataset: 'Key indicators',
      Indicator: 'Latest Revenue (US$M)',
      Value: latestRevenue ? String(latestRevenue.value) : '—',
      Period: latestRevenue?.fiscal_year || '',
    },
    ...visibleArrivalTrend.map((record) => ({
      Dataset: 'Tourist Arrivals Trend',
      Year: record.year,
      'Total arrivals': record.total_arrivals,
    })),
    ...visibleSourceMarkets.map((record) => ({
      Dataset: 'Top Source Markets',
      Year: record.year,
      Nationality: record.nationality,
      Arrivals: record.arrivals,
      Percentage: record.percent,
    })),
    ...visibleRevenueTrend.map((record) => ({
      Dataset: 'Revenue Trend',
      'Fiscal year': record.fiscal_year,
      Metric: record.metric,
      Value: record.value,
      Unit: record.unit,
    })),
    ...visibleAvgStay.map((record) => ({
      Dataset: 'Average Length of Stay',
      Year: record.year,
      'Average stay (days)': record.value,
      Unit: record.unit,
    })),
    ...purposeTrend.map((record) => ({
      Dataset: 'Purpose of Visit',
      Year: record.year,
      Category: record.category,
      Arrivals: record.value,
    })),
    ...trekkingTrend.map((record) => ({
      Dataset: 'Trekking Areas',
      Year: record.year,
      Region: record.region,
      Trekkers: record.trekkers,
    })),
    ...allSexTrend.map((record) => ({
      Dataset: 'Arrivals by Sex',
      Year: record.year,
      Gender: record.gender,
      Arrivals: record.value,
      'Statistic type': record.statistic_type,
    })),
    ...ageTrend.map((record) => ({
      Dataset: 'Arrivals by Age Group',
      Year: record.year,
      'Age group': record.age_group,
      Arrivals: record.value,
    })),
    ...(provinceTourism.by_year || []).map((record) => ({
      Dataset: 'Provincial Tourism',
      Year: record.year,
      Province: record.province,
      Visitors: record.visitors,
    })),
    ...(provinceTourism.latest || []).flatMap((item) =>
      (item.destinations || []).map((dest) => ({
        Dataset: 'Provincial Tourism Destinations',
        Year: provinceLatestYear || '',
        Province: item.province,
        Destination: dest.name,
        Visitors: dest.visitors,
        'Share (%)': dest.share,
      }))
    ),
  ];

  const reportFiscalYear =
    activeTab === 'revenue'
      ? latestRevenue?.fiscal_year || sourceMarketYear || ''
      : activeTab === 'source-markets'
        ? sourceMarketYear || ''
        : visibleArrivalTrend.at(-1)?.year || '';

  const handleDownloadReport = () =>
    downloadTourismReport({
      fiscal_year: String(sourceMarketYear || ''),
      selected_indicators: [
        'arrivals',
        'source-markets',
        'revenue',
        'stay',
        'purpose',
        'trekking',
        'sex',
        'age',
        'province',
      ],
      active_tab: activeTab,
      arrival_range: arrivalRange,
      revenue_range: revenueRange,
      stay_range: stayRange,
      include_all_source_markets: showAllSourceMarkets,
      purpose_year: selectedPurposeYear,
      trekking_year: selectedTrekkingYear,
      sex_year: selectedSexYear,
      age_year: selectedAgeYear,
      filters: {},
    });

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-onSurface font-hanken">Tourism Statistics</h3>
          <p className="text-onSurface-variant text-sm font-hanken">
            Source: Department of Tourism and Nepal Rastra Bank
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Tourists',
              value: kpis?.total_tourists ?? '—',
              icon: 'flight',
              up: true,
              change: '',
              sub: '',
            },
            {
              label: 'Growth %',
              value: kpis?.growth_percent ?? '—',
              icon: 'trending_up',
              up: (kpis?.growth_percent || 0) >= 0,
              change: '',
              sub: '',
            },
            {
              label: 'Top Source',
              value: kpis?.top_source_country?.nationality
                ? formatCountryName(kpis.top_source_country.nationality)
                : '—',
              icon: 'map',
              up: true,
              change: '',
              sub: '',
            },
            {
              label: 'Latest Revenue',
              value: latestRevenue ? `$${latestRevenue.value}M` : '—',
              icon: 'payments',
              up: true,
              change: '',
              sub: latestRevenue?.fiscal_year || '',
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-surface border border-outline-variant rounded-sm p-5 card-shadow"
              style={{ borderTop: '3px solid #7a5100' }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold uppercase text-onSurface-variant tracking-wider font-hanken">
                  {stat.label}
                </span>
                <Icon name={stat.icon} size={20} color="#7a5100" />
              </div>
              <p className="text-2xl font-bold text-onSurface font-hanken">{stat.value}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Icon
                  name={stat.up ? 'trending_up' : 'trending_down'}
                  size={14}
                  color={stat.up ? '#0f7a3d' : '#b70011'}
                />
                <span
                  className="text-sm font-bold font-hanken"
                  style={{ color: stat.up ? '#0f7a3d' : '#b70011' }}
                >
                  {stat.change}
                </span>
                <span className="text-xs text-onSurface-variant font-hanken">{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Sticky section navigator — underline tab strip (line format) */}
        <nav className="sticky top-0 z-20 -mx-1 border-b border-outline-variant bg-white/95 backdrop-blur">
          <div className="flex items-stretch overflow-x-auto">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`whitespace-nowrap px-6 py-3 text-sm font-medium font-hanken transition-colors duration-200 border-b-2 ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-onSurface-variant hover:text-onSurface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Scrollable stacked sections — paired charts side by side */}
        <div className="space-y-6">
          {SECTION_ROWS.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={`grid grid-cols-1 gap-6 ${row.length > 1 ? 'lg:grid-cols-2' : ''}`}
            >
              {row.map((id) => {
                const meta = TABS.find((tab) => tab.id === id);
                return (
                  <div key={id} id={`tourism-${id}`} className="scroll-mt-20">
                    <SectionCard
                      title={meta.label}
                      subtitle={sectionSubtitle(id)}
                      action={sectionAction(id)}
                      className="rounded-sm"
                    >
                      {renderSectionContent(id)}
                    </SectionCard>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DataFooter
          csvData={csvData}
          csvFilename="tourism.csv"
          datasetLabel="Tourism"
          reportTitle="Tourism Dashboard Report"
          onDownloadReport={handleDownloadReport}
          reportMeta={{
            fiscalYear: reportFiscalYear,
            selectedProvince: '',
            indicators:
              'Tourist Arrivals Trend, Top Source Markets, Revenue Trend, Average Length of Stay, Purpose of Visit, Trekking Areas, Arrivals by Sex, Arrivals by Age Group, Tourism by Province',
            periodRange: [
              arrivalRange === 'all' ? 'All arrival years' : `${arrivalRange} arrival years`,
              showAllSourceMarkets ? 'All source markets' : 'Top 10 source markets',
              revenueRange === 'all' ? 'All revenue years' : `${revenueRange} revenue years`,
              stayRange === 'all' ? 'All stay years' : `${stayRange} stay years`,
              selectedPurposeYear ? `Purpose year ${selectedPurposeYear}` : '',
              selectedTrekkingYear ? `Trekking year ${selectedTrekkingYear}` : '',
              selectedSexYear ? `Sex year ${selectedSexYear}` : '',
              selectedAgeYear ? `Age group year ${selectedAgeYear}` : '',
              provinceLatestYear ? `Province year ${provinceLatestYear}` : '',
              activeProvince ? `Province ${activeProvince}` : '',
            ]
              .filter(Boolean)
              .join(' | '),
          }}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loading && !error && !tourismData && (
          <p className="text-sm text-onSurface-variant">No tourism data is available.</p>
        )}
    </div>
  );
}