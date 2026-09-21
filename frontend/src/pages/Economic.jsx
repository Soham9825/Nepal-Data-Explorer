import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import MetricCard from '../components/cards/MetricCard';
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

export default function Economic() {
  const [data, setData] = useState(null);
  const [indicator, setIndicator] = useState('sectors');
  const [year, setYear] = useState('All');
  const [range, setRange] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const growth = data?.global_growth || [];
  const trade = data?.trade || [];
  const sectors = data?.sectoral_growth || [];
  const periodOptions =
    indicator === 'growth'
      ? [...new Set(growth.map((item) => item.year))].sort()
      : indicator === 'trade'
        ? [...new Set(trade.map((item) => item.year))].sort()
        : [...new Set(sectors.map((item) => item.year))].sort();
  const latestSectorYear = [...new Set(sectors.map((item) => item.year))]
    .sort((a, b) => Number(String(a).slice(0, 4)) - Number(String(b).slice(0, 4)))
    .at(-1);
  const recentItems = (items) => {
    const periodItems = year === 'All' ? items : items.filter((item) => item.year === year);
    if (year !== 'All' || range === 'all') return periodItems;
    const years = [...new Set(periodItems.map((item) => item.year))];
    const visibleYears = new Set(years.slice(-Number(range)));
    return periodItems.filter((item) => visibleYears.has(item.year));
  };
  const filteredGrowth = recentItems(growth)
    .map((item) => ({ ...item, value: Number(item.value) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => String(a.year).localeCompare(String(b.year), undefined, { numeric: true }));
  const filteredTrade = recentItems(trade);
  const latestGrowth = [...growth]
    .filter((item) => Number.isFinite(Number(item.value)))
    .sort((a, b) => String(a.year).localeCompare(String(b.year), undefined, { numeric: true }))
    .at(-1);
  const latestTradeYear = trade.at(-1)?.year;
  const latestTrade = trade.filter((item) => item.year === latestTradeYear);
  const exportsValue = latestTrade.find((item) => item.group === 'Export')?.value;
  const importsValue = latestTrade.find((item) => item.group === 'Import')?.value;
  const chartData =
    indicator === 'growth'
      ? filteredGrowth.map((item) => ({ year: item.year.replace('Real_', ''), value: item.value }))
      : filteredTrade.reduce((rows, item) => {
          const row = rows.find((entry) => entry.year === item.year) || { year: item.year };
          row[item.group === 'Export' ? 'exports' : 'imports'] = item.value;
          if (!rows.includes(row)) rows.push(row);
          return rows;
        }, []);
  const sectorChart = useMemo(() => {
    const selectedYear = year === 'All' ? latestSectorYear : year;
    return sectors
      .filter((item) => item.year === selectedYear)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
      .map((item) => ({ name: item.sector, value: item.value, color: COLORS.primary }));
  }, [sectors, year, latestSectorYear]);
  const sectorFanData = sectorChart.map((item) => ({
    year: item.name,
    value: item.value,
  }));
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
  const provinceCards = [
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
  const chartTitle =
    indicator === 'growth'
      ? 'World Output Real Growth'
      : indicator === 'trade'
        ? 'Total Exports vs Imports'
        : indicator === 'province'
          ? 'Province-wise GDP Growth Rate'
          : 'Sectoral Growth';
  const chartSubtitle =
    indicator === 'growth'
      ? 'World Output real series from the global economics dataset'
      : indicator === 'trade'
        ? 'Total trade values by fiscal year'
        : indicator === 'province'
          ? selectedProvince === 'All'
            ? 'Annual real growth (%) per province by fiscal year — CBS series'
            : `${selectedProvince} annual real growth (%) by fiscal year — CBS series`
          : `Top sectors in ${year === 'All' ? latestSectorYear || 'latest year' : year}`;
  const cards = [
    {
      label: 'World Output Growth',
      value: latestGrowth ? `${formatValue(latestGrowth.value)}%` : '—',
      subtitle: latestGrowth?.year?.replace('Real_', '') || 'Real series',
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
  ];
  const csvData = [
    {
      Dataset: 'Key indicators',
      Indicator: 'World Output Growth',
      Value: latestGrowth ? `${formatValue(latestGrowth.value)}%` : '—',
      Period: latestGrowth?.year?.replace('Real_', '') || '',
    },
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
    ...filteredGrowth.map((item) => ({
      Dataset: 'World Output Growth',
      Year: item.year.replace('Real_', ''),
      Value: item.value,
      Unit: '%',
    })),
    ...filteredTrade.map((item) => ({
      Dataset: 'Foreign Trade',
      Year: item.year,
      Group: item.group,
      Value: item.value,
      Unit: item.unit,
    })),
    ...sectorChart.map((item) => ({
      Dataset: 'Sectoral Growth',
      Sector: item.name,
      Value: item.value,
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

  const reportFiscalYear =
    year === 'All'
      ? indicator === 'growth'
        ? latestGrowth?.year?.replace('Real_', '') || ''
        : indicator === 'trade'
          ? latestTradeYear || ''
          : latestSectorYear || ''
      : year;

  const handleDownloadReport = () =>
    downloadEconomicReport({
      selected_indicators: ['growth', 'trade', 'sectors'],
      indicator,
      year,
      range,
      filters: {},
    });

  if (loading) {
    return (
      <DashboardLayout pageTitle="Economic Data">
        <div className="flex min-h-[520px] items-center justify-center">
          <Loader size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Economic Data">
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
          {[...cards, ...provinceCards].map((card) => (
            <MetricCard key={card.label} {...card} change={card.change ?? ''} trend="up" />
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-sm border border-outline-variant bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ['sectors', 'Sectoral Growth'],
              ['province', 'Province-wise GDP'],
              ['trade', 'Trade'],
              ['growth', 'World Output Growth'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setIndicator(id);
                  setYear('All');
                }}
                className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${indicator === id ? 'bg-primary text-white' : 'border border-outline-variant bg-white text-onSurface-variant hover:border-primary hover:text-primary'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {(indicator === 'growth' || indicator === 'trade') && (
            <div className="flex shrink-0 items-center gap-1 rounded-sm border border-outline-variant bg-white p-1">
              {[
                ['all', 'All'],
                ['10', '10 years'],
                ['5', '5 years'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setRange(id)}
                  className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${range === id ? 'bg-primary text-white' : 'text-onSurface-variant hover:bg-surface-container-highest'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {indicator === 'sectors' && (
            <select
              value={periodOptions.includes(year) ? year : latestSectorYear || ''}
              onChange={(event) => setYear(event.target.value)}
              className="w-full rounded-sm border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-onSurface sm:w-auto"
            >
              {periodOptions.map((value) => (
                <option key={value} value={value}>
                  {value.replace('Real_', '')}
                </option>
              ))}
            </select>
          )}
        </div>
        <SectionCard
          title={chartTitle}
          subtitle={chartSubtitle}
          action={indicator === 'province' ? gdpStatusChip : null}
          className="overflow-hidden rounded-sm"
          contentClassName="p-0"
        >
          {indicator === 'province' ? (
            <div className="flex h-[640px] flex-col">
              <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {['All', ...PROVINCE_ORDER].map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedProvince(name)}
                      className={`rounded-sm px-3.5 py-2 text-sm font-semibold transition-colors ${selectedProvince === name ? 'bg-primary text-white' : 'border border-outline-variant bg-white text-onSurface-variant hover:border-primary hover:text-primary'}`}
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
          ) : (
            <div
              className={`${indicator === 'sectors' ? 'h-[620px]' : 'h-[520px]'} min-h-[400px] min-w-0 w-full overflow-hidden`}
            >
              {indicator === 'sectors' ? (
                <RadialFanChart data={sectorFanData} title="Sectoral Growth" unit="%" />
              ) : indicator === 'growth' ? (
                <LineChart
                  data={chartData}
                  xKey="year"
                  labelKey="year"
                  tooltipKey="year"
                  series={[{ key: 'value', color: COLORS.primary, label: 'Real growth (%)' }]}
                  height="100%"
                  unit="%"
                  showZeroLine
                />
              ) : (
                <BarChart
                  data={chartData}
                  xKey="year"
                  series={[
                    { key: 'exports', color: COLORS.success, label: 'Exports' },
                    { key: 'imports', color: COLORS.danger, label: 'Imports' },
                  ]}
                  height="100%"
                  bordered={false}
                />
              )}
            </div>
          )}
        </SectionCard>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loading && !error && !data && (
          <p className="text-sm text-onSurface-variant">No economic data is available.</p>
        )}
        <DataFooter
          csvData={csvData}
          csvFilename="economic-dataset.csv"
          datasetLabel="Economic"
          reportTitle="Economic Dashboard Report"
          onDownloadReport={handleDownloadReport}
          reportMeta={{
            fiscalYear: reportFiscalYear,
            indicators: 'World Output Growth, Foreign Trade, Sectoral Growth, Province-wise GDP Growth',
            periodRange: range === 'all' ? 'All years' : `${range} years`,
            selectedProvince: selectedProvince === 'All' ? '' : selectedProvince,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
