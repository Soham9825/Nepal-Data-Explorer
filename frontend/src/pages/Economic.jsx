import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import { SectionCard } from "../components/ui/Card";
import MetricCard from "../components/cards/MetricCard";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import RadialFanChart from "../components/charts/RadialFanChart";
import DataFooter from "../components/common/DataFooter";
import Loader from "../components/common/Loader";
import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/api/analytics/economic/?compact=1`;
const COLORS = { primary: "#0051d5", accent: "#7a5100", danger: "#b70011", success: "#0f7a3d" };
const formatValue = (value) => (value == null ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }));

export default function Economic() {
  const [data, setData] = useState(null);
  const [indicator, setIndicator] = useState("growth");
  const [year, setYear] = useState("All");
  const [range, setRange] = useState("5");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API_URL, { headers: { Accept: "application/json" }, credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`Economic API error: ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const growth = data?.global_growth || [];
  const trade = data?.trade || [];
  const sectors = data?.sectoral_growth || [];
  const periodOptions = indicator === "growth"
    ? [...new Set(growth.map((item) => item.year))].sort()
    : indicator === "trade"
      ? [...new Set(trade.map((item) => item.year))].sort()
      : [...new Set(sectors.map((item) => item.year))].sort();
  const latestSectorYear = [...new Set(sectors.map((item) => item.year))]
    .sort((a, b) => Number(String(a).slice(0, 4)) - Number(String(b).slice(0, 4)))
    .at(-1);
  const recentItems = (items) => {
    const periodItems = year === "All" ? items : items.filter((item) => item.year === year);
    if (year !== "All" || range === "all") return periodItems;
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
  const exportsValue = latestTrade.find((item) => item.group === "Export")?.value;
  const importsValue = latestTrade.find((item) => item.group === "Import")?.value;
  const chartData = indicator === "growth"
    ? filteredGrowth.map((item) => ({ year: item.year.replace("Real_", ""), value: item.value }))
    : filteredTrade.reduce((rows, item) => {
        const row = rows.find((entry) => entry.year === item.year) || { year: item.year };
        row[item.group === "Export" ? "exports" : "imports"] = item.value;
        if (!rows.includes(row)) rows.push(row);
        return rows;
      }, []);
  const sectorChart = useMemo(() => {
    const selectedYear = year === "All" ? latestSectorYear : year;
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
  const chartTitle = indicator === "growth" ? "World Output Real Growth" : indicator === "trade" ? "Total Exports vs Imports" : "Sectoral Growth";
  const chartSubtitle = indicator === "growth" ? "World Output real series from the global economics dataset" : indicator === "trade" ? "Total trade values by fiscal year" : `Top sectors in ${year === "All" ? latestSectorYear || "latest year" : year}`;
  const cards = [
    { label: "World Output Growth", value: latestGrowth ? `${formatValue(latestGrowth.value)}%` : "—", subtitle: latestGrowth?.year?.replace("Real_", "") || "Real series", icon: "trending_up", color: COLORS.primary },
    { label: "Total Exports", value: exportsValue == null ? "—" : formatValue(exportsValue), subtitle: latestTradeYear || "Latest fiscal year", icon: "north_east", color: COLORS.success },
    { label: "Total Imports", value: importsValue == null ? "—" : formatValue(importsValue), subtitle: latestTradeYear || "Latest fiscal year", icon: "south_west", color: COLORS.danger },
  ];
  const csvData = indicator === "growth"
    ? filteredGrowth.map((item) => ({ Year: item.year.replace("Real_", ""), Value: item.value, Unit: "%" }))
    : indicator === "trade"
      ? filteredTrade.map((item) => ({ Year: item.year, Group: item.group, Value: item.value, Unit: item.unit }))
      : sectorChart.map((item) => ({ Sector: item.name, Value: item.value }));

  if (loading) {
    return (
      <DashboardLayout pageTitle="Economic Data">
        <div className="flex min-h-[520px] items-center justify-center">
          <Loader size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout pageTitle="Economic Data">
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-onSurface">Economic Data</h1>
          <p className="mt-1 text-onSurface-variant">Real economic series from the connected datasets</p>
          </div>
        </div>
      <div className="grid gap-6 md:grid-cols-3">{cards.map((card) => <MetricCard key={card.label} {...card} change="" trend="up" />)}</div>
      <div className="flex flex-col gap-4 rounded-sm border border-outline-variant bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[["growth", "World Output Growth"], ["trade", "Trade"], ["sectors", "Sectoral Growth"]].map(([id, label]) => <button key={id} onClick={() => { setIndicator(id); setYear("All"); }} className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${indicator === id ? "bg-primary text-white" : "border border-outline-variant bg-white text-onSurface-variant hover:border-primary hover:text-primary"}`}>{label}</button>)}
        </div>
        {indicator !== "sectors" && (
          <div className="flex shrink-0 items-center gap-1 rounded-sm border border-outline-variant bg-white p-1">
            {[["5", "5 years"], ["10", "10 years"], ["all", "All"]].map(([id, label]) => <button key={id} onClick={() => setRange(id)} className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${range === id ? "bg-primary text-white" : "text-onSurface-variant hover:bg-surface-container-highest"}`}>{label}</button>)}
          </div>
        )}
        {indicator === "sectors" && (
          <select
            value={periodOptions.includes(year) ? year : latestSectorYear || ""}
            onChange={(event) => setYear(event.target.value)}
            className="w-full rounded-sm border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-onSurface sm:w-auto"
          >
            {periodOptions.map((value) => <option key={value} value={value}>{value.replace("Real_", "")}</option>)}
          </select>
        )}
      </div>
      <SectionCard title={chartTitle} subtitle={chartSubtitle} className="overflow-hidden rounded-sm" contentClassName="p-0">
        <div className={`${indicator === "sectors" ? "h-[620px]" : "h-[520px]"} min-h-[400px] min-w-0 w-full overflow-hidden`}>
          {indicator === "sectors" ? <RadialFanChart data={sectorFanData} title="Sectoral Growth" unit="%" /> : indicator === "growth" ? <LineChart data={chartData} xKey="year" labelKey="year" tooltipKey="year" series={[{ key: "value", color: COLORS.primary, label: "Real growth (%)" }]} height="100%" unit="%" xPadding={48} showZeroLine /> : <BarChart data={chartData} xKey="year" series={[{ key: "exports", color: COLORS.success, label: "Exports" }, { key: "imports", color: COLORS.danger, label: "Imports" }]} height="100%" bordered={false} />}
        </div>
      </SectionCard>
      {error && <p className="text-sm text-danger">{error}</p>}{!loading && !error && !data && <p className="text-sm text-onSurface-variant">No economic data is available.</p>}
      <DataFooter csvData={csvData} csvFilename={`economic-${indicator}.csv`} />
    </div>
  </DashboardLayout>;
}