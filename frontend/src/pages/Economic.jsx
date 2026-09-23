import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../components/ui/Card';
import MetricCard from '../components/cards/MetricCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import RadialFanChart from '../components/charts/RadialFanChart';
import DataFooter from '../components/common/DataFooter';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import { API_BASE_URL } from '../config';
import { downloadEconomicReport } from '../services/reportApi';
import {
  GROWTH_METRICS,
  PROVINCE_COLORS,
  PROVINCE_ORDER,
  buildGrowthChartData,
  fetchProvinceGDP,
  latestAverage,
  latestProvinceRecord,
  latestSum,
} from '../services/provinceGDP';

const API_URL = `${API_BASE_URL}/api/analytics/economic/?compact=1`;
const COLORS = { primary: '#0051d5', accent: '#7a5100', danger: '#b70011', success: '#0f7a3d' };
const ECONOMY_PALETTE = [
  '#0051d5',
  '#0f7a3d',
  '#b70011',
  '#e6a700',
  '#7c4dff',
  '#009688',
  '#d81b60',
  '#455a64',
];
const SALARY_PALETTE = ['#0051d5', '#b70011', '#0f7a3d', '#e6a700', '#7c4dff'];
const PARTNER_COLORS = [
  { key: 'India', color: '#0051d5', label: 'India' },
  { key: 'China', color: '#b70011', label: 'China' },
  { key: 'Other Countries', color: '#0f7a3d', label: 'Other countries' },
];
const SECTOR_PALETTE = [
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
  '#9333ea',
  '#0891b2',
];
const CHART_HEIGHT = 'h-80';
const formatValue = (value) =>
  value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const formatCompact = (value) => {
  if (value == null) return '—';
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  const absolute = Math.abs(n);
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(0)}K`;
  return formatValue(n);
};

const TABS = [
  { id: 'sectoral', label: 'Sectoral Growth' },
  { id: 'overall', label: 'Economy-wide Growth' },
  { id: 'growth', label: 'World Output Growth' },
  { id: 'economies', label: 'Global Economies' },
  { id: 'trade', label: 'Foreign Trade' },
  { id: 'partners', label: 'Trade by Partner' },
  { id: 'balance', label: 'Trade Balance' },
  { id: 'salary', label: 'Salary & Wage Rate' },
  { id: 'appi', label: 'Agri Producer Prices' },
  { id: 'province', label: 'Province GDP' },
];
const SECTION_ROWS = [
  ['sectoral', 'overall'],
  ['growth', 'economies'],
  ['trade', 'partners'],
  ['balance', 'salary'],
  ['appi'],
  ['province'],
];

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

export default function Economic() {
  const [activeTab, setActiveTab] = useState('sectoral');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [growthRange, setGrowthRange] = useState('all');
  const [tradeRange, setTradeRange] = useState('all');
  const [balanceRange, setBalanceRange] = useState('all');
  const [sectorYear, setSectorYear] = useState('');
  const [appiYear, setAppiYear] = useState('');
  const [partnerView, setPartnerView] = useState('exports');
  const [provinceGdp, setProvinceGdp] = useState(null);
  const [provinceGdpLoading, setProvinceGdpLoading] = useState(true);
  const [provinceGdpError, setProvinceGdpError] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('All');
  const [growthMetric, setGrowthMetric] = useState('basic_price');

  useEffect(() => {
    fetch(API_URL, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`Economic API error: ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProvinceGDP()
      .then(setProvinceGdp)
      .catch((requestError) => setProvinceGdpError(requestError.message))
      .finally(() => setProvinceGdpLoading(false));
  }, []);

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(`economic-${id}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- World output growth ---------------------------------------------------------
  const growthAll = useMemo(
    () =>
      (data?.global_growth || [])
        .map((item) => ({ ...item, value: Number(item.value), year: Number(String(item.year).replace('Real_', '')) }))
        .filter((item) => Number.isFinite(item.value))
        .sort((a, b) => a.year - b.year),
    [data]
  );
  const visibleGrowth =
    growthRange === 'all' ? growthAll : growthAll.slice(-Number(growthRange));
  const latestGrowth = growthAll.at(-1);

  // --- Global economies --------------------------------------------------------------
  const economiesRows = (data?.economies_growth || []).map((row) => ({
    ...row,
    year: String(row.year).replace('Real_', ''),
  }));
  const economyContexts = useMemo(() => {
    const contexts = {};
    (data?.economies_growth || []).forEach((row) =>
      Object.keys(row).forEach((key) => {
        if (key !== 'year') contexts[key] = true;
      })
    );
    return Object.keys(contexts);
  }, [data]);

  // --- Sectors ----------------------------------------------------------------------
  const sectors = useMemo(() => data?.sectoral_growth || [], [data]);
  const sectorYears = useMemo(
    () =>
      [...new Set(sectors.map((item) => String(item.year)))].sort(
        (a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4))
      ),
    [sectors]
  );
  const resolvedSectorYear = sectorYears.includes(sectorYear) ? sectorYear : sectorYears[0] || '';
  const sectorFanData = sectors
    .filter((item) => String(item.year) === resolvedSectorYear)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 12)
    .map((item) => ({ year: item.sector, value: Number(item.value) }));

  // --- Economy-wide growth ------------------------------------------------------------
  const overallRows = (data?.overall_growth || []).map((row) => ({
    ...row,
    agriculture: row.agriculture ?? null,
    nonagriculture: row.nonagriculture ?? null,
    industry: row.industry ?? null,
    service: row.service ?? null,
  }));

  // --- Trade -------------------------------------------------------------------------
  const tradeHistory = (data?.trade || []).reduce((rows, item) => {
    const row = rows.find((entry) => entry.year === item.year) || {
      year: item.year,
      exports: null,
      imports: null,
    };
    row[item.group === 'Export' ? 'exports' : 'imports'] = Number(item.value);
    if (!rows.includes(row)) rows.push(row);
    return rows;
  }, []);
  const visibleTrade =
    tradeRange === 'all' ? tradeHistory : tradeHistory.slice(-Number(tradeRange));
  const latestTradeYear = tradeHistory.at(-1)?.year;
  const latestTrade = tradeHistory.at(-1) || {};
  const exportsValue = latestTrade.exports;
  const importsValue = latestTrade.imports;

  // --- Trade by partner ----------------------------------------------------------------
  const partnerYearSort = (a, b) => Number(a.fiscal_year.slice(0, 4)) - Number(b.fiscal_year.slice(0, 4));
  const exportsPartner = [...(data?.exports_by_partner || [])].sort(partnerYearSort);
  const importsPartner = [...(data?.imports_by_partner || [])].sort(partnerYearSort);
  const partnerRows = partnerView === 'exports' ? exportsPartner : importsPartner;

  // --- Trade balance ------------------------------------------------------------------
  const balanceAll = [...(data?.trade_balance || [])].sort(
    (a, b) => Number(a.fiscal_year.slice(0, 4)) - Number(b.fiscal_year.slice(0, 4))
  );
  const visibleBalance =
    balanceRange === 'all' ? balanceAll : balanceAll.slice(-Number(balanceRange));

  // --- Salary & wage rate ----------------------------------------------------------------
  const salaryRows = useMemo(() => data?.salary_index || [], [data]);
  const salaryGroups = [
    'Overall Index',
    'Wage Rate Index',
    'Government Service',
    'Education',
    'Bank & Financial Institutions',
  ].filter((group) => salaryRows.some((row) => row.group === group));
  const salaryYears = useMemo(
    () => [...new Set(salaryRows.map((row) => row.year))].sort((a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4))),
    [salaryRows]
  );
  const salaryChartData = salaryYears.map((year) => {
    const row = { year };
    salaryGroups.forEach((group) => {
      const point = salaryRows.find((item) => item.group === group && item.year === year);
      row[group] = point ? Number(point.value) : null;
    });
    return row;
  });

  // --- Agriculture producer price index ---------------------------------------------------
  const appiRows = useMemo(() => data?.appi || [], [data]);
  const appiCandidates = useMemo(
    () =>
      [...new Set(
        appiRows
          .filter((row) => row.quarter === 'ANN')
          .map((row) => row.base_year)
      )].sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4))),
    [appiRows]
  );
  const resolvedAppiYear = appiCandidates.includes(appiYear) ? appiYear : appiCandidates[0] || '';
  const appiAnnual = appiRows.filter(
    (row) => row.base_year === resolvedAppiYear && row.quarter === 'ANN'
  );
  const appiSorted = [...appiAnnual].sort((a, b) => Number(b.value) - Number(a.value));
  const maxAppi = Math.max(...appiSorted.map((row) => Number(row.value) || 0), 0);

  // --- Province GDP ----------------------------------------------------------------------
  const gdpGrowthRows = buildGrowthChartData(provinceGdp, growthMetric, selectedProvince);
  const gdpSeries =
    selectedProvince === 'All'
      ? (provinceGdp?.provinces || []).map((name) => ({
          key: name,
          color: PROVINCE_COLORS[name],
          label: name,
        }))
      : [
          {
            key: 'value',
            color: PROVINCE_COLORS[selectedProvince],
            label: 'Growth %',
          },
        ];
  const gdpLatestBlock = latestProvinceRecord(provinceGdp, selectedProvince);
  const selectedGdpRecord =
    selectedProvince === 'All' ? null : provinceGdp?.latest?.provinces?.[selectedProvince] || null;
  const latestGdpYear = provinceGdp?.latest?.fiscal_year || '';
  const growthField = growthMetric === 'purchaser_price' ? 'growth_purchaser_price' : 'growth_basic_price';
  const gdpStatusChip = provinceGdp?.latest?.data_status ? (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-bold ${
        provinceGdp.latest.data_status === 'Provisional'
          ? 'bg-[#fef3c7] text-[#92400e]'
          : provinceGdp.latest.data_status === 'Revised'
            ? 'bg-[#e0e7ff] text-[#3730a3]'
            : 'bg-[#d1fae5] text-[#065f46]'
      }`}
    >
      {provinceGdp.latest.data_status} {latestGdpYear}
    </span>
  ) : null;

  const sectionSubtitle = (id) => {
    if (id === 'sectoral')
      return `Top sectors in ${resolvedSectorYear || 'latest year'} · SectoralGrowth`;
    if (id === 'overall')
      return 'Growth by agriculture / non-agriculture / industry / service by fiscal year';
    if (id === 'growth') return 'World Output real series from the global economics dataset';
    if (id === 'economies') return 'Real growth by economy and economic bloc';
    if (id === 'trade') return 'Total trade values by fiscal year';
    if (id === 'partners')
      return `${partnerView === 'exports' ? 'Exports' : 'Imports'} by major partner (units as recorded)`;
    if (id === 'balance') return 'Exports minus imports per fiscal year';
    if (id === 'salary') return 'Index by category across fiscal years';
    if (id === 'appi') return `Annual index by product · base year ${resolvedAppiYear}`;
    if (id === 'province')
      return selectedProvince === 'All'
        ? 'Annual real growth (%) per province by fiscal year — CBS series'
        : `${selectedProvince} annual real growth (%) by fiscal year — CBS series`;
    return 'Economic statistics';
  };

  const sectionAction = (id) => {
    if (id === 'growth' || id === 'trade' || id === 'balance') {
      const rangeState = id === 'growth' ? growthRange : id === 'trade' ? tradeRange : balanceRange;
      const setRange = id === 'growth' ? setGrowthRange : id === 'trade' ? setTradeRange : setBalanceRange;
      return (
        <div className="flex items-center gap-1 rounded-sm border border-outline-variant bg-white p-1">
          {[
            ['all', 'All'],
            ['10', '10 years'],
            ['5', '5 years'],
          ].map(([rangeId, label]) => (
            <button
              key={rangeId}
              onClick={() => setRange(rangeId)}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${rangeState === rangeId ? 'bg-primary text-white' : 'text-onSurface-variant hover:bg-surface-container-highest'}`}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }
    if (id === 'sectoral' && sectorYears.length > 1) {
      return (
        <select
          value={resolvedSectorYear}
          onChange={(event) => setSectorYear(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {sectorYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }
    if (id === 'partners') {
      return (
        <div className="flex items-center gap-1 rounded-sm border border-outline-variant bg-white p-1">
          {[
            ['exports', 'Exports'],
            ['imports', 'Imports'],
          ].map(([viewId, label]) => (
            <button
              key={viewId}
              onClick={() => setPartnerView(viewId)}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${partnerView === viewId ? 'bg-primary text-white' : 'text-onSurface-variant hover:bg-surface-container-highest'}`}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }
    if (id === 'appi' && appiCandidates.length > 1) {
      return (
        <select
          value={resolvedAppiYear}
          onChange={(event) => setAppiYear(event.target.value)}
          className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
        >
          {appiCandidates.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      );
    }
    return null;
  };

  const renderSectionContent = (id) => {
    if (id === 'sectoral') {
      return (
        <ChartBox>
          <RadialFanChart data={sectorFanData} title="Sectoral Growth" unit="%" />
        </ChartBox>
      );
    }
    if (id === 'overall') {
      return (
        <ChartBox>
          <LineChart
            data={overallRows}
            xKey="fiscal_year"
            labelKey="fiscal_year"
            tooltipKey="fiscal_year"
            series={[
              { key: 'agriculture', color: '#0f7a3d', label: 'Agriculture' },
              { key: 'nonagriculture', color: '#0051d5', label: 'Non-agriculture' },
              { key: 'industry', color: '#b70011', label: 'Industry' },
              { key: 'service', color: '#e6a700', label: 'Service' },
            ]}
            height="100%"
            unit="%"
            showZeroLine
          />
        </ChartBox>
      );
    }
    if (id === 'growth') {
      return (
        <ChartBox>
          <LineChart
            data={visibleGrowth.map((item) => ({ year: item.year, value: item.value }))}
            xKey="year"
            labelKey="year"
            tooltipKey="year"
            series={[{ key: 'value', color: COLORS.primary, label: 'Real growth (%)' }]}
            height="100%"
            unit="%"
            showZeroLine
          />
        </ChartBox>
      );
    }
    if (id === 'economies') {
      return (
        <ChartBox>
          <LineChart
            data={economiesRows}
            xKey="year"
            labelKey="year"
            tooltipKey="year"
            series={economyContexts.map((context, index) => ({
              key: context,
              color: ECONOMY_PALETTE[index % ECONOMY_PALETTE.length],
              label: context,
            }))}
            height="100%"
            unit="%"
            showZeroLine
          />
        </ChartBox>
      );
    }
    if (id === 'trade') {
      return (
        <ChartBox>
          <BarChart
            data={visibleTrade}
            xKey="year"
            series={[
              { key: 'exports', color: COLORS.success, label: 'Exports' },
              { key: 'imports', color: COLORS.danger, label: 'Imports' },
            ]}
            height="100%"
            bordered={false}
          />
        </ChartBox>
      );
    }
    if (id === 'partners') {
      return (
        <ChartBox>
          <BarChart
            data={partnerRows}
            xKey="fiscal_year"
            series={PARTNER_COLORS}
            height="100%"
            bordered={false}
          />
        </ChartBox>
      );
    }
    if (id === 'balance') {
      return (
        <ChartBox>
          <LineChart
            data={visibleBalance.map((item) => ({ year: item.fiscal_year, value: item.value }))}
            xKey="year"
            labelKey="year"
            tooltipKey="year"
            series={[{ key: 'value', color: COLORS.success, label: 'Trade balance' }]}
            height="100%"
            unit=""
            showZeroLine
          />
        </ChartBox>
      );
    }
    if (id === 'salary') {
      return (
        <ChartBox>
          <LineChart
            data={salaryChartData}
            xKey="year"
            labelKey="year"
            tooltipKey="year"
            series={salaryGroups.map((group, index) => ({
              key: group,
              color: SALARY_PALETTE[index % SALARY_PALETTE.length],
              label: group,
            }))}
            height="100%"
          />
        </ChartBox>
      );
    }
    if (id === 'appi') {
      return (
        <TwoColumn
          left={
            <ChartBox>
              <BarChart
                data={appiSorted.map((row, index) => ({
                  name: row.product,
                  value: Number(row.value) || 0,
                  color: SECTOR_PALETTE[index % SECTOR_PALETTE.length],
                }))}
                labelKey="name"
                valueKey="value"
                height="100%"
                bordered={false}
              />
            </ChartBox>
          }
          right={
            <SideList
              title={`Products · ${resolvedAppiYear}`}
              count={appiSorted.length}
              items={appiSorted.map((row, index) => ({
                label: row.product,
                value: formatValue(row.value),
                pct: maxAppi ? (Number(row.value) / maxAppi) * 100 : 0,
                color: SECTOR_PALETTE[index % SECTOR_PALETTE.length],
              }))}
            />
          }
        />
      );
    }
    if (id === 'province') {
      return (
        <div className="flex h-[640px] flex-col">
          <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-x-1 border-b-2 border-transparent empty:hidden">
              {['All', ...PROVINCE_ORDER].map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedProvince(name)}
                  className={`whitespace-nowrap px-4 py-2 text-sm font-medium font-hanken transition-colors duration-200 border-b-2 ${
                    selectedProvince === name
                      ? 'border-primary text-primary'
                      : 'border-transparent text-onSurface-variant hover:text-onSurface'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1 self-start rounded-sm border border-outline-variant bg-white p-1 lg:self-auto">
              {Object.values(GROWTH_METRICS).map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => setGrowthMetric(metric.key)}
                  className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${growthMetric === metric.key ? 'bg-primary text-white' : 'text-onSurface-variant hover:bg-surface-container-highest'}`}
                >
                  {metric.shortLabel}
                </button>
              ))}
            </div>
          </div>
          {provinceGdpLoading ? (
            <div className="flex min-h-[380px] flex-1 items-center justify-center">
              <Loader size="lg" />
            </div>
          ) : provinceGdpError ? (
            <div className="flex min-h-[380px] flex-1 items-center justify-center p-6">
              <ErrorMessage
                title="Failed to load province GDP data"
                message={provinceGdpError}
                onRetry={() => window.location.reload()}
              />
            </div>
          ) : gdpGrowthRows.length === 0 ? (
            <div className="flex min-h-[380px] flex-1 items-center justify-center p-6 text-sm text-onSurface-variant">
              No province-wise GDP data is available for{' '}
              {selectedProvince === 'All' ? 'the selected filters' : selectedProvince}.
            </div>
          ) : (
            <div className="min-h-0 flex-1 p-5">
              <BarChart
                data={gdpGrowthRows}
                xKey="fiscal_year"
                series={gdpSeries}
                height="100%"
                bordered={false}
                showLegend={selectedProvince === 'All'}
              />
            </div>
          )}
          <div className="border-t border-outline-variant px-5 py-3 text-xs text-onSurface-variant">
            Source: CBS province-wise GDP series. Growth values show annual change for each fiscal
            year; R = revised, P = provisional figures.
          </div>
        </div>
      );
    }
    return null;
  };

  const cards = [
    {
      label: 'World Output Growth',
      value: latestGrowth ? `${formatValue(latestGrowth.value)}%` : '—',
      subtitle: latestGrowth?.year ?? 'Real series',
      icon: 'trending_up',
      color: COLORS.primary,
    },
    {
      label: 'Total Exports',
      value: exportsValue == null ? '—' : formatValue(exportsValue),
      subtitle: latestTradeYear || 'Latest fiscal year',
      icon: 'north_east',
      color: COLORS.success,
    },
    {
      label: 'Total Imports',
      value: importsValue == null ? '—' : formatValue(importsValue),
      subtitle: latestTradeYear || 'Latest fiscal year',
      icon: 'south_west',
      color: COLORS.danger,
    },
    {
      label: 'GDP at Current Prices',
      value: formatCompact(
        selectedProvince === 'All' ? latestSum(provinceGdp, 'gdp_current') : selectedGdpRecord?.gdp_current
      ),
      subtitle: 'NRs., latest fiscal year',
      change: gdpLatestBlock ? `${latestGdpYear} · ${gdpLatestBlock.dataStatus}` : 'Unavailable',
      icon: 'payments',
      color: PROVINCE_COLORS[selectedProvince] || '#0051d5',
    },
    {
      label: 'GDP at Constant Prices',
      value: formatCompact(
        selectedProvince === 'All' ? latestSum(provinceGdp, 'gdp_constant') : selectedGdpRecord?.gdp_constant
      ),
      subtitle: 'NRs., latest fiscal year',
      change: latestGdpYear || 'Unavailable',
      icon: 'account_balance',
      color: '#316bf3',
    },
    {
      label: 'GDP per Capita',
      value: formatCompact(
        selectedProvince === 'All'
          ? latestAverage(provinceGdp, 'per_capita_gdp_nrs')
          : selectedGdpRecord?.per_capita_gdp_nrs
      ),
      subtitle: selectedProvince === 'All' ? 'NRs., province average' : 'NRs.',
      change: latestGdpYear || 'Unavailable',
      icon: 'person',
      color: '#0f7a3d',
    },
    {
      label: `Growth (${GROWTH_METRICS[growthMetric].shortLabel})`,
      value:
        (selectedProvince === 'All'
          ? latestAverage(provinceGdp, growthField)
          : selectedGdpRecord?.[growthField]) == null
          ? '—'
          : `${formatValue(
              selectedProvince === 'All'
                ? latestAverage(provinceGdp, growthField)
                : selectedGdpRecord?.[growthField]
            )}%`,
      subtitle: selectedProvince === 'All' ? 'Latest FY average' : selectedProvince,
      change: latestGdpYear || 'Unavailable',
      icon: 'trending_up',
      color: '#b70011',
    },
  ];

  const csvData = [
    ...(latestGrowth
      ? [
          {
            Dataset: 'Key indicators',
            Indicator: 'World Output Growth',
            Value: `${formatValue(latestGrowth.value)}%`,
            Period: latestGrowth.year,
          },
        ]
      : []),
    {
      Dataset: 'Key indicators',
      Indicator: 'Total Exports',
      Value: exportsValue == null ? '—' : formatValue(exportsValue),
      Period: latestTradeYear || '',
    },
    {
      Dataset: 'Key indicators',
      Indicator: 'Total Imports',
      Value: importsValue == null ? '—' : formatValue(importsValue),
      Period: latestTradeYear || '',
    },
    ...growthAll.map((item) => ({
      Dataset: 'World Output Growth',
      Year: item.year,
      Value: item.value,
      Unit: '%',
    })),
    ...(data?.economies_growth || []).flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== 'year' && row[key] != null)
        .map(([key, value]) => ({
          Dataset: 'Global Economies Growth',
          Year: String(row.year).replace('Real_', ''),
          Economy: key,
          Value: value,
          Unit: '%',
        }))
    ),
    ...(data?.overall_growth || []).flatMap((row) =>
      ['agriculture', 'nonagriculture', 'industry', 'service'].flatMap((key) =>
        row[key] == null
          ? []
          : [
              {
                Dataset: 'Economy-wide Growth',
                'Fiscal Year': row.fiscal_year,
                Component: key,
                Value: row[key],
                Unit: '%',
              },
            ]
      )
    ),
    ...tradeHistory.map((item) => ({
      Dataset: 'Foreign Trade',
      Year: item.year,
      Group: item.exports != null ? 'Exports / Imports' : 'Imports',
      Exports: item.exports ?? '',
      Imports: item.imports ?? '',
    })),
    ...(data?.exports_by_partner || []).flatMap((row) =>
      ['India', 'China', 'Other Countries'].flatMap((partnerName) =>
        row[partnerName] == null
          ? []
          : [
              {
                Dataset: 'Foreign Trade by Partner',
                'Fiscal Year': row.fiscal_year,
                Flow: 'Exports',
                Partner: partnerName,
                Value: row[partnerName],
              },
            ]
      )
    ),
    ...(data?.imports_by_partner || []).flatMap((row) =>
      ['India', 'China', 'Other Countries'].flatMap((partnerName) =>
        row[partnerName] == null
          ? []
          : [
              {
                Dataset: 'Foreign Trade by Partner',
                'Fiscal Year': row.fiscal_year,
                Flow: 'Imports',
                Partner: partnerName,
                Value: row[partnerName],
              },
            ]
      )
    ),
    ...(data?.trade_balance || []).map((row) => ({
      Dataset: 'Foreign Trade by Partner',
      'Fiscal Year': row.fiscal_year,
      Flow: 'Trade balance',
      Value: row.value,
    })),
    ...sectorChartRows(),
    ...(data?.salary_index || []).map((row) => ({
      Dataset: 'Salary & Wage Rate Index',
      Year: row.year,
      Category: row.group,
      Value: row.value,
      Unit: 'Index',
    })),
    ...(data?.appi || []).map((row) => ({
      Dataset: 'Agriculture Producer Price Index',
      Product: row.product,
      'Base Year': row.base_year,
      Quarter: row.quarter,
      Value: row.value,
      Unit: 'Index',
    })),
    ...(provinceGdp?.growth?.basic_price || []).flatMap((row) =>
      (provinceGdp.provinces || []).map((name) => ({
        Dataset: 'Province-wise GDP growth',
        'Fiscal Year': row.fiscal_year,
        Province: name,
        'Growth Basic Price (%)': row[name] ?? '',
        'Growth Purchaser Price (%)':
          provinceGdp.growth.purchaser_price?.find((r) => r.fiscal_year === row.fiscal_year)?.[name] ?? '',
      }))
    ),
  ];

  function sectorChartRows() {
    return sectorFanData.map((item) => ({
      Dataset: 'Sectoral Growth',
      Year: resolvedSectorYear,
      Sector: item.year,
      Value: item.value,
      Unit: '%',
    }));
  }

  const handleDownloadReport = () =>
    downloadEconomicReport({
      selected_indicators: ['growth', 'trade', 'sectors'],
      indicator: 'sectors',
      year: resolvedSectorYear,
      range: growthRange,
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
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-onSurface">Economic Data</h1>
          <p className="mt-1 text-onSurface-variant">
            Real economic series from the connected datasets
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} change={card.change ?? ''} trend="up" />
        ))}
      </div>

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

      <div className="space-y-6">
        {SECTION_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-1 gap-6 ${row.length > 1 ? 'lg:grid-cols-2' : ''}`}
          >
            {row.map((id) => {
              const meta = TABS.find((tab) => tab.id === id);
              return (
                <div key={id} id={`economic-${id}`} className="scroll-mt-20">
                  <SectionCard
                    title={meta.label}
                    subtitle={sectionSubtitle(id)}
                    action={
                      id === 'province' ? gdpStatusChip : sectionAction(id)
                    }
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
        csvFilename="economic-dataset.csv"
        datasetLabel="Economic"
        reportTitle="Economic Dashboard Report"
        onDownloadReport={handleDownloadReport}
        reportMeta={{
          fiscalYear: resolvedSectorYear,
          selectedProvince: selectedProvince === 'All' ? '' : selectedProvince,
          indicators:
            'Sectoral Growth, Economy-wide Growth, World Output Growth, Global Economies Growth, Foreign Trade, Trade by Partner, Trade Balance, Salary & Wage Rate Index, Agriculture Producer Price Index, Province-wise GDP Growth',
          periodRange: [
            growthRange === 'all' ? 'All world-output years' : `${growthRange} world-output years`,
            tradeRange === 'all' ? 'All trade years' : `${tradeRange} trade years`,
            balanceRange === 'all' ? 'All balance years' : `${balanceRange} balance years`,
            resolvedSectorYear ? `Sector year ${resolvedSectorYear}` : '',
            resolvedAppiYear ? `APPI base year ${resolvedAppiYear}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
        }}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && !data && (
        <p className="text-sm text-onSurface-variant">No economic data is available.</p>
      )}
    </div>
  );
}