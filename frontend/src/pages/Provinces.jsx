import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SectionCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import ErrorMessage from '../components/common/ErrorMessage';
import Loader from '../components/common/Loader';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import PieChart from '../components/charts/PieChart';
import { PROVINCE_PATHS } from '../data/provincePaths';
import { PROVINCE_ORDER } from '../services/provinceGDP';
import { fetchProvinceDashboard, fetchProvincePopulation } from '../services/provincesAPI';

const MIN_ID = 1;
const MAX_ID = 7;

// Share-chart palette (matches the bar-chart palette elsewhere in the app).
const SHARE_COLORS = ['#b70011', '#0051d5', '#7a5100', '#316bf3', '#9a6800', '#5c403c', '#0f7a3d', '#dc2626'];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCompact = (value) => {
  const number = toNumber(value);
  if (number == null) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
};

const formatThousands = (value) => {
  const number = toNumber(value);
  return number == null ? '—' : number.toLocaleString('en');
};

const FactRow = ({ icon, label, value, color = '#0051d5' }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="flex items-center gap-2 text-sm text-onSurface-variant">
      <Icon name={icon} size={16} color={color} />
      {label}
    </span>
    <span className="text-right text-sm font-bold text-onSurface">{value}</span>
  </div>
);

const DestinationCarousel = ({ destinations = [], shape }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState([]);
  const [remountKey, setRemountKey] = useState(0);
  const attemptsRef = useRef({});

  const slides = destinations.filter(
    (d) => d.image_url && !failed.includes(d.image_url)
  );
  const count = slides.length;

  useEffect(() => {
    setIndex(0);
  }, [destinations.length, shape?.id, failed.length]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), 4000);
    return () => clearInterval(timer);
  }, [count, paused]);

  // Wikimedia's Special:FilePath endpoint is occasionally throttled (503) and
  // answers fine on a retry, so try each image twice before giving up. Failed
  // slides are dropped and the carousel falls back to the placeholder instead
  // of ever showing a broken image.
  const markImageFailed = (d) => {
    const url = d.image_url;
    const attempts = (attemptsRef.current[url] || 0) + 1;
    attemptsRef.current[url] = attempts;
    if (attempts >= 2) {
      setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));
    } else {
      setRemountKey((key) => key + 1);
    }
  };

  const safeIndex = count ? index % count : 0;
  const current = slides[safeIndex] || destinations[0] || null;

  return (
    <SectionCard
      title={`${shape?.name} Province`}
      subtitle={count ? 'Destination photos' : 'No destination photos yet'}
      className="xl:col-span-2 card-shadow hover:border-primary transition-colors duration-200"
      contentClassName="p-0"
      action={
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          <Icon name="photo_library" size={14} color="#b70011" />
          {count ? `${safeIndex + 1} / ${count}` : 'No photos'}
        </span>
      }
    >
      <div
        className="relative h-80 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
{count === 0 ? (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-center"
              style={{
                background: `linear-gradient(135deg, ${shape?.fill || '#b70011'}26, ${shape?.fill || '#b70011'}59)`,
              }}
            >
              <Icon name="photo_camera" size={44} color={shape?.fill || '#b70011'} />
              <span className="px-4 text-sm font-semibold text-onSurface">
                {destinations[0]?.name || 'No destination photos yet'}
              </span>
            </div>
          ) : (
            <div
              className="flex h-full w-full"
              style={{ transform: `translateX(-${safeIndex * 100}%)`, transition: 'transform 500ms ease-in-out' }}
            >
              {slides.map((d) => (
                <img
                  key={`${d.image_url}-${remountKey}`}
                  src={d.image_url}
                  alt={d.name}
                  loading="lazy"
                  onError={() => markImageFailed(d)}
                  className="h-full w-full shrink-0 object-cover"
                />
              ))}
            </div>
          )}

        <span className="absolute bottom-2 right-2 z-10 rounded-sm bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
          Photo: Wikimedia Commons
        </span>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous destination photo"
              onClick={() => setIndex((index - 1 + count) % count)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <Icon name="chevron_left" size={22} color="#ffffff" />
            </button>
            <button
              type="button"
              aria-label="Next destination photo"
              onClick={() => setIndex((index + 1) % count)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <Icon name="chevron_right" size={22} color="#ffffff" />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5">
              {slides.map((_, dotIndex) => (
                <button
                  key={dotIndex}
                  type="button"
                  aria-label={`Go to photo ${dotIndex + 1}`}
                  onClick={() => setIndex(dotIndex)}
                  className={`h-2 rounded-full transition-all ${
                    dotIndex === index ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {current && (
        <div className="flex min-h-[68px] items-center justify-between gap-3 border-t border-outline-variant px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-bold text-onSurface">{current.name}</h4>
            </div>
            {current.description && (
              <p className="mt-1 truncate text-xs text-onSurface-variant">{current.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {current.annual_visitors != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-onSurface">
                <Icon name="group" size={13} color="#0f7a3d" />
                {formatThousands(current.annual_visitors)} visitors / yr
              </span>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default function Provinces() {
  const navigate = useNavigate();
  const { id } = useParams();

  const urlId = Number(id);
  const selectedId =
    Number.isInteger(urlId) && urlId >= MIN_ID && urlId <= MAX_ID ? urlId : MIN_ID;
  const selectedShape = selectedId != null ? PROVINCE_PATHS.find((p) => p.id === selectedId) : null;
  const selectedName = selectedShape?.name || null;

  const [population, setPopulation] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareYear, setShareYear] = useState(null);

  useEffect(() => {
    setShareYear(null);
  }, [selectedName]);

  useEffect(() => {
    let mounted = true;
    fetchProvincePopulation()
      .then((rows) => { if (mounted) setPopulation(rows); })
      .catch(() => { if (mounted) setPopulation([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!selectedName) {
      setDashboard(null);
      setError(null);
      setLoading(false);
      return () => { mounted = false; };
    }
    setLoading(true);
    setError(null);
    fetchProvinceDashboard(selectedName)
      .then((payload) => { if (mounted) setDashboard(payload); })
      .catch((err) => { if (mounted) setError(err.message || 'Failed to load province data.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [selectedName]);

  const handleSelect = (provinceId) => {
    navigate(`/provinces/${provinceId}`);
  };

  const populationByCode = useMemo(() => {
    const map = {};
    population.forEach((p) => { map[Number(p.province_code)] = p; });
    return map;
  }, [population]);

  const selectedPopulation = selectedId != null ? populationByCode[selectedId] || null : null;

  const gdpRows = useMemo(() => {
    const rows = Array.isArray(dashboard?.economy?.gdp) ? dashboard.economy.gdp : [];
    return rows
      .map((row) => ({
        fiscal_year: row.fiscal_year,
        gdp: toNumber(row.gdp_current),
        growth: toNumber(row.growth_purchaser_price),
      }))
      .filter((row) => row.gdp != null);
  }, [dashboard]);

  const growthRows = useMemo(
    () => gdpRows.map((row) => ({ fiscal_year: row.fiscal_year, value: row.growth })).filter((row) => row.value != null),
    [gdpRows]
  );

  const latestGdp = gdpRows[gdpRows.length - 1] || null;

  const destinations = (() => {
    const official = Array.isArray(dashboard?.tourism?.official_destinations) ? dashboard.tourism.official_destinations : [];
    if (official.length) return official;
    return Array.isArray(dashboard?.tourism?.destinations) ? dashboard.tourism.destinations : [];
  })();

  const visitsByYear = useMemo(() => {
    const visits = Array.isArray(dashboard?.tourism?.visits) ? dashboard.tourism.visits : [];
    const totals = {};
    visits.forEach((v) => {
      totals[v.year] = (totals[v.year] || 0) + (toNumber(v.visitor_count) || 0);
    });
    return Object.keys(totals)
      .sort((a, b) => a - b)
      .map((year) => ({ year, visitors: totals[year] }));
  }, [dashboard]);

  const shareYears = useMemo(() => {
    const visits = Array.isArray(dashboard?.tourism?.visits) ? dashboard.tourism.visits : [];
    return [...new Set(visits.map((v) => v.year))].sort((a, b) => a - b);
  }, [dashboard]);

  const activeShareYear = shareYear ?? shareYears[shareYears.length - 1] ?? null;

  const destinationShare = useMemo(() => {
    const visits = Array.isArray(dashboard?.tourism?.visits) ? dashboard.tourism.visits : [];
    if (!visits.length || activeShareYear == null) return { items: [], total: 0, year: null };
    const officialDestinations = Array.isArray(dashboard?.tourism?.official_destinations) ? dashboard.tourism.official_destinations : [];
    const displayName = new Map(officialDestinations.map((d) => [d.official_name, d.name]));
    const totals = new Map();
    visits.forEach((v) => {
      if (v.year !== activeShareYear) return;
      totals.set(v.destination, (totals.get(v.destination) || 0) + (toNumber(v.visitor_count) || 0));
    });
    const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
    const items = Array.from(totals, ([destination, visitor_count], index) => ({
      destination: displayName.get(destination) || destination,
      visitor_count,
      share: total > 0 ? (visitor_count / total) * 100 : 0,
      color: SHARE_COLORS[index % SHARE_COLORS.length],
    }))
      .sort((a, b) => b.visitor_count - a.visitor_count)
      .map((item, index) => ({ ...item, color: SHARE_COLORS[index % SHARE_COLORS.length] }));
    return { items, total, year: activeShareYear };
  }, [dashboard, activeShareYear]);

  const visitYears = visitsByYear.length
    ? `${visitsByYear[0].year}–${visitsByYear[visitsByYear.length - 1].year}`
    : null;

  if (selectedName && loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (selectedName && error) {
    return (
      <ErrorMessage
        title={`Failed to load ${selectedName} data`}
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6">
        {/* Province nav */}
        <nav className="sticky top-0 z-20 -mx-1 border-b border-outline-variant bg-white/95 backdrop-blur">
          <div className="flex items-stretch overflow-x-auto">
            {PROVINCE_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  const shape = PROVINCE_PATHS.find((p) => p.name === name);
                  if (shape) handleSelect(shape.id);
                }}
                className={`whitespace-nowrap px-6 py-3 text-sm font-medium font-hanken transition-colors duration-200 border-b-2 ${
                  name === selectedName
                    ? 'border-primary text-primary'
                    : 'border-transparent text-onSurface-variant hover:text-onSurface'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-onSurface font-hanken">
              {selectedName ? `${selectedName} Province` : 'Province Explorer'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-onSurface-variant font-hanken">
              A look at the province’s signature destinations, economy, tourism and population.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-3 py-1.5 text-sm font-bold text-onSurface">
            <Icon name="map" size={16} color="#b70011" />
            {selectedName ? `${selectedName} · ${selectedShape?.hq}` : 'All 7 Provinces'}
          </span>
        </div>

        {/* Spotlight + Province summary */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <DestinationCarousel destinations={destinations} shape={selectedShape} />

          <SectionCard
            title={selectedName}
            subtitle={`${selectedShape?.hq} — headquarters`}
            className="card-shadow"
          >
            <div className="divide-y divide-outline-variant">
              <FactRow icon="location_city" label="Headquarters" value={selectedShape?.hq} color="#7a5100" />
              <FactRow
                icon="groups"
                label="Population"
                value={selectedPopulation ? formatThousands(selectedPopulation.total_population) : '—'}
                color="#0051d5"
              />
              <FactRow
                icon="percent"
                label="Share of Nepal"
                value={selectedPopulation?.pct != null ? `${toNumber(selectedPopulation.pct)}%` : '—'}
                color="#0051d5"
              />
              <FactRow
                icon="density_small"
                label="Density"
                value={selectedPopulation?.population_density != null ? `${formatCompact(selectedPopulation.population_density)} p/km²` : '—'}
                color="#7a5100"
              />
              <FactRow icon="place" label="Destinations" value={String(destinations.length)} color="#316bf3" />
              <FactRow
                icon="payments"
                label="Latest GDP"
                value={latestGdp ? formatCompact(latestGdp.gdp) : '—'}
                color="#0f7a3d"
              />
            </div>
          </SectionCard>
        </section>

        {/* Economy */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="GDP Trend" subtitle="Nominal GDP at current prices, NPR million">
            <LineChart
              data={gdpRows}
              xKey="fiscal_year"
              labelKey="fiscal_year"
              series={[{ key: 'gdp', color: '#0051d5', label: 'GDP (current price)' }]}
              height={320}
            />
          </SectionCard>
          <SectionCard title="GDP Growth Rate" subtitle="Annual growth at purchaser prices (%)">
            <div className="h-80">
              <BarChart
                data={growthRows}
                labelKey="fiscal_year"
                valueKey="value"
                color="#0f7a3d"
                bordered={false}
              />
            </div>
          </SectionCard>
        </section>

        {/* Official tourism statistics */}
        {visitsByYear.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title="Tourism Visits by Year"
              subtitle={visitYears ? `Official destination totals, ${visitYears} · Nepal Tourism Statistics` : 'Official destination visits by year'}
            >
              <div className="h-80">
                <BarChart
                  data={visitsByYear}
                  labelKey="year"
                  valueKey="visitors"
                  color="#b70011"
                  bordered={false}
                />
              </div>
            </SectionCard>
            <SectionCard
              title="Visitor Share by Destination"
              subtitle={destinationShare.year ? `Share of official visits, ${destinationShare.year} · Nepal Tourism Statistics` : 'Share of official visitor counts'}
            >
              <div className="flex h-80 flex-col items-center justify-center gap-6 overflow-y-auto pr-1 lg:flex-row lg:gap-8">
                {destinationShare.items.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-onSurface-variant">
                    No data available
                  </div>
                ) : (
                  <>
                    <div className="relative shrink-0">
                      <PieChart data={destinationShare.items.map((item) => ({ value: item.visitor_count, color: item.color }))} />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-bold text-onSurface">{formatCompact(destinationShare.total)}</span>
                        <span className="text-[10px] uppercase tracking-wide text-onSurface-variant">visitors</span>
                      </div>
                    </div>
                    <ul className="grid w-full gap-x-6 gap-y-3 lg:w-auto">
                      {destinationShare.items.map((item) => (
                        <li key={item.destination} className="flex min-w-0 items-center gap-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-xs font-semibold text-onSurface" title={item.destination}>
                            {item.destination}
                          </span>
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-onSurface-variant">
                            {formatThousands(item.visitor_count)}
                          </span>
                          <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-onSurface">
                            {item.share.toFixed(1)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              {destinationShare.items.length === 1 && (
                <p className="mt-1 px-1 text-xs text-onSurface-variant">
                  {selectedName} has a single recorded official destination (
                  {destinationShare.items[0].destination}), so it accounts for 100% of this
                  year's visitors.
                </p>
              )}
            </SectionCard>
          </section>
        )}

        {/* Tourism destinations */}
        <SectionCard
          title={`Tourism Destinations · ${selectedName}`}
          subtitle={destinations.length ? 'Official dataset destinations with visitor counts' : 'Use the seed command to populate destinations'}
          className="card-shadow"
        >
          {destinations.length === 0 ? (
            <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 text-center text-onSurface-variant">
              <Icon name="tour" size={32} />
              <p className="text-sm">No destinations are seeded for this province yet.</p>
              <p className="text-xs">
                Run <code className="rounded bg-surface-container-highest px-1.5 py-0.5">python manage.py import_province_curated</code> to add them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {destinations.map((destination, index) => (
                <div key={`${destination.name}-${index}`} className="flex gap-3 rounded-sm border border-outline-variant p-4 hover:border-primary transition-colors duration-200">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-onSurface">{destination.name}</h4>
                    {destination.description ? (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-onSurface-variant">
                        {destination.description}
                      </p>
                    ) : (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-onSurface-variant">
                        {[destination.district, destination.destination_type, destination.visitor_scope]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {destination.annual_visitors != null && (
                      <p className="mt-1.5 text-xs font-semibold text-secondary">
                        {formatThousands(destination.annual_visitors)} visitors / yr
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
    </div>
  );
}