import React, { useMemo, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { SectionCard } from "../components/ui/Card";
import MetricCard from "../components/cards/MetricCard";
import AreaChart from "../components/charts/AreaChart";
import BarChart from "../components/charts/BarChart";
import { GDP_DATA } from "../data/dummyData";
import DataFooter from "../components/common/DataFooter";

const YEARS = ["All", "2019", "2020", "2021", "2022", "2023"];

const INDICATOR_TABS = [
  ["gdp", "GDP Growth", "trending_up"],
  ["inflation", "Inflation", "percent"],
  ["trade", "Trade Balance", "swap_horiz"],
];

const theme = {
  primary: "#0051d5",
  accent: "#7a5100",
  danger: "#b70011",
  success: "#0f7a3d",  // Export — outgoing, success
  imports: "#0051d5",  // Import — incoming, blue
};

export default function Economic() {
  const [year, setYear] = useState("All");
  const [indicator, setIndicator] = useState("gdp");

  const filtered = useMemo(() => {
    return year === "All" ? GDP_DATA : GDP_DATA.filter((item) => item.year === year);
  }, [year]);

  const latest = filtered[filtered.length - 1] || GDP_DATA[GDP_DATA.length - 1];
  const latestIdx = GDP_DATA.findIndex((d) => d.year === latest.year);
  const prev = latestIdx > 0 ? GDP_DATA[latestIdx - 1] : null;

  const deficit = latest.imports - latest.exports;
  const prevDeficit = prev ? prev.imports - prev.exports : null;

  const cards = [
    {
      label: "GDP (USD)",
      value: `$${latest.gdp}B`,
      change: prev
        ? `${latest.gdp - prev.gdp >= 0 ? "+" : ""}${(latest.gdp - prev.gdp).toFixed(1)}B YoY`
        : "First year",
      up: prev ? latest.gdp >= prev.gdp : true,
      icon: "payments",
      color: theme.primary,
      subtitle: "Gross domestic product",
    },
    {
      label: "Inflation",
      value: `${latest.inflation}%`,
      change: prev
        ? `${latest.inflation - prev.inflation >= 0 ? "+" : ""}${(latest.inflation - prev.inflation).toFixed(1)} pts YoY`
        : "First year",
      up: prev ? latest.inflation <= prev.inflation : true,
      icon: "trending_up",
      color: theme.accent,
      subtitle: "Consumer price movement",
    },
    {
      label: "Trade Deficit",
      value: `$${deficit.toFixed(1)}B`,
      change: prevDeficit !== null
        ? `${deficit - prevDeficit >= 0 ? "+" : ""}${(((deficit - prevDeficit) / Math.abs(prevDeficit)) * 100).toFixed(1)}% YoY`
        : "First year",
      up: prevDeficit !== null ? deficit <= prevDeficit : true,
      icon: "swap_horiz",
      color: theme.danger,
      subtitle: "Imports minus exports",
    },
  ];

  const chartTitle =
    indicator === "gdp"
      ? "GDP Growth Rate (%)"
      : indicator === "inflation"
      ? "Inflation Rate (%)"
      : "Trade: Exports vs Imports ($B)";

  const maxTrade = Math.max(latest.exports, latest.imports);

  return (
    <DashboardLayout pageTitle="Economic Data">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between gap-5 lg:items-end">
          <div>
            <h1 className="text-3xl font-bold text-onSurface">Economic Data</h1>
            <p className="text-onSurface-variant mt-1">
              GDP, Inflation & Trade Balance • Nepal Rastra Bank
            </p>
          </div>

          <div className="flex flex-wrap border border-outline-variant rounded-sm overflow-hidden">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  year === y
                    ? "bg-primary text-white"
                    : "bg-surface text-onSurface-variant hover:bg-surface-container-lowest"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              change={card.change}
              trend={card.up ? "up" : "down"}
              subtitle={card.subtitle}
              icon={card.icon}
              color={card.color}
            />
          ))}
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-3">
          {INDICATOR_TABS.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setIndicator(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-sm text-sm font-medium transition-colors ${
                indicator === id
                  ? "bg-primary text-white"
                  : "bg-surface border border-outline-variant text-onSurface-variant hover:bg-surface-container-lowest"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* CHART SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
          <div className="xl:col-span-8">
            <SectionCard
              title={chartTitle}
              subtitle="Source: Nepal Rastra Bank — Annual Data"
              className="rounded-sm h-full"
            >
              <div className="flex-1 min-h-[400px]">
                {indicator === "trade" ? (
                  <BarChart
                    data={filtered}
                    xKey="year"
                    series={[
                      { key: "exports", color: theme.success, label: "Exports" },
                      { key: "imports", color: theme.imports, label: "Imports" },
                    ]}
                    height="100%"
                  />
                ) : (
                  <AreaChart
                    data={filtered}
                    xKey="year"
                    yKey={indicator === "gdp" ? "value" : "inflation"}
                    color={theme.primary}
                    height="100%"
                  />
                )}
              </div>
            </SectionCard>
          </div>

          {/* SUMMARY */}
          <div className="xl:col-span-4">
            <SectionCard
              title="Economic Overview"
              className="rounded-sm h-full"
              contentClassName="flex flex-col justify-between h-full"
            >
              <div className="space-y-5 flex-1">
                {[
                  { label: "GDP", value: `$${latest.gdp}B`, icon: "payments", color: theme.primary },
                  { label: "GDP Growth", value: `${latest.value}%`, icon: "trending_up", color: theme.primary },
                  { label: "Inflation", value: `${latest.inflation}%`, icon: "monitoring", color: theme.accent },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between ${
                      i === 0 ? "" : "border-t border-outline-variant pt-5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-[18px] rounded-sm p-1.5"
                        style={{ color: row.color, backgroundColor: `${row.color}14` }}
                      >
                        {row.icon}
                      </span>
                      <p className="text-sm text-onSurface-variant">{row.label}</p>
                    </div>
                    <h3 className="text-2xl font-semibold text-onSurface">{row.value}</h3>
                  </div>
                ))}
              </div>

              {/* Trade balance visual — pinned to fill remaining space */}
              <div className="border-t border-outline-variant pt-5 mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-onSurface-variant">Exports vs Imports</p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-sm"
                    style={{ color: theme.danger, backgroundColor: `${theme.danger}14` }}
                  >
                    {deficit >= 0 ? "Deficit" : "Surplus"} ${Math.abs(deficit).toFixed(1)}B
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-onSurface-variant mb-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: theme.success }}
                        />
                        Exports
                      </span>
                      <span className="font-medium text-onSurface">${latest.exports}B</span>
                    </div>
                    <div className="h-2 rounded-sm bg-surface-container-lowest overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${(latest.exports / maxTrade) * 100}%`,
                          backgroundColor: theme.success,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-onSurface-variant mb-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: theme.imports }}
                        />
                        Imports
                      </span>
                      <span className="font-medium text-onSurface">${latest.imports}B</span>
                    </div>
                    <div className="h-2 rounded-sm bg-surface-container-lowest overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${(latest.imports / maxTrade) * 100}%`,
                          backgroundColor: theme.imports,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <DataFooter />
      </div>
    </DashboardLayout>
  );
}