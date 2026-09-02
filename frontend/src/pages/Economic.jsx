import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { SectionCard } from "../components/ui/Card";
import MetricCard from "../components/cards/MetricCard";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DataFooter from "../components/common/DataFooter";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/analytics/economic/?compact=1`;
const COLORS = { primary: "#0051d5", accent: "#7a5100", danger: "#b70011", success: "#0f7a3d" };
const formatValue = (value) => (value == null ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }));

export default function Economic() {
  const [data, setData] = useState(null);
  const [indicator, setIndicator] = useState("growth");
  const [year, setYear] = useState("All");
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
  const filteredGrowth = year === "All" ? growth : growth.filter((item) => item.year === year);
  const filteredTrade = year === "All" ? trade : trade.filter((item) => item.year === year);
  const latestGrowth = growth.at(-1);
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
    const selectedYear = year === "All" ? sectors.at(-1)?.year : year;
    return sectors.filter((item) => item.year === selectedYear).sort((a, b) => b.value - a.value).slice(0, 12).map((item) => ({ name: item.sector, value: item.value, color: COLORS.primary }));
  }, [sectors, year]);
  const chartTitle = indicator === "growth" ? "World Output Real Growth" : indicator === "trade" ? "Total Exports vs Imports" : "Sectoral Growth";
  const chartSubtitle = indicator === "growth" ? "World Output real series from the global economics dataset" : indicator === "trade" ? "Total trade values by fiscal year" : `Top sectors in ${year === "All" ? sectors.at(-1)?.year || "latest year" : year}`;
  const cards = [
    { label: "World Output Growth", value: latestGrowth ? `${formatValue(latestGrowth.value)}%` : "—", subtitle: latestGrowth?.year?.replace("Real_", "") || "Real series", icon: "trending_up", color: COLORS.primary },
    { label: "Total Exports", value: exportsValue == null ? "—" : formatValue(exportsValue), subtitle: latestTradeYear || "Latest fiscal year", icon: "north_east", color: COLORS.success },
    { label: "Total Imports", value: importsValue == null ? "—" : formatValue(importsValue), subtitle: latestTradeYear || "Latest fiscal year", icon: "south_west", color: COLORS.danger },
  ];

  return <DashboardLayout pageTitle="Economic Data">
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row justify-between gap-5 lg:items-end"><div><h1 className="text-3xl font-bold text-onSurface">Economic Data</h1><p className="text-onSurface-variant mt-1">Real economic series from the connected datasets</p></div><select value={periodOptions.includes(year) ? year : "All"} onChange={(event) => setYear(event.target.value)} className="border border-outline-variant rounded-sm bg-surface px-3 py-2 text-sm font-medium text-onSurface"><option value="All">All periods</option>{periodOptions.map((value) => <option key={value} value={value}>{value.replace("Real_", "")}</option>)}</select></div>
      <div className="grid gap-6 md:grid-cols-3">{cards.map((card) => <MetricCard key={card.label} {...card} change="" trend="up" />)}</div>
      <div className="flex flex-wrap gap-3">{[["growth", "World Output Growth"], ["trade", "Trade"], ["sectors", "Sectoral Growth"]].map(([id, label]) => <button key={id} onClick={() => { setIndicator(id); setYear("All"); }} className={`px-5 py-2 rounded-sm text-sm font-medium ${indicator === id ? "bg-primary text-white" : "bg-surface border border-outline-variant text-onSurface-variant"}`}>{label}</button>)}</div>
      <SectionCard title={chartTitle} subtitle={chartSubtitle} className="rounded-sm"><div className="min-h-[400px]">{indicator === "sectors" ? <BarChart data={sectorChart} xKey="name" valueKey="value" labelKey="name" height="100%" bordered={false} /> : indicator === "growth" ? <LineChart data={chartData} xKey="year" series={[{ key: "value", color: COLORS.primary, label: "Growth (%)" }]} height="100%" /> : <BarChart data={chartData} xKey="year" series={[{ key: "exports", color: COLORS.success, label: "Exports" }, { key: "imports", color: COLORS.danger, label: "Imports" }]} height="100%" bordered={false} />}</div></SectionCard>
      {error && <p className="text-sm text-danger">{error}</p>}{!loading && !error && !data && <p className="text-sm text-onSurface-variant">No economic data is available.</p>}
      <DataFooter />
    </div>
  </DashboardLayout>;
}
