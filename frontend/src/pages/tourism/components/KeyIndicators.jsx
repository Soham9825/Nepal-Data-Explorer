import { getCountryFlag } from '../../../utils/countryFlags';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { formatCompact, formatMarketName, formatNumber, formatPercent } from '../format';
import ChangeBadge from './ChangeBadge';
import SummaryCard from './SummaryCard';

/**
 * The four key indicator cards: arrivals, revenue, average stay and the top
 * source market.
 *
 * The top market prefers the KPI block the endpoint computes, and falls back to
 * the head of the ranked source markets when that is missing, so the card still
 * names a market on a payload that only carries the trend.
 */
export default function KeyIndicators({ trends, topSource, topMarket }) {
  const { latestArrival, latestRevenue, latestStay, arrivalChange, revenueChange, stayChange } =
    trends;

  const topMarketName = topSource?.nationality
    ? formatMarketName(topSource.nationality)
    : topMarket?.nationality
      ? formatMarketName(topMarket.nationality)
      : null;
  const topMarketFlag = topSource?.nationality
    ? getCountryFlag(topSource.nationality)
    : topMarket?.nationality
      ? getCountryFlag(topMarket.nationality)
      : null;

  const cards = [
    {
      label: 'Tourist arrivals',
      value: latestArrival ? formatCompact(latestArrival.total_arrivals) : '—',
      detail: latestArrival
        ? `${formatNumber(latestArrival.total_arrivals)} in ${latestArrival.year}`
        : 'No annual total available',
      badge: <ChangeBadge value={arrivalChange} label="vs previous year" />,
      icon: 'flight_takeoff',
      accent: COLORS.arrivals,
    },
    {
      label: 'Tourism revenue',
      value: latestRevenue ? `US$${formatCompact(latestRevenue.value)}M` : '—',
      detail: latestRevenue
        ? `US$ millions · ${latestRevenue.fiscal_year}${
            latestRevenue.fiscal_year.endsWith('*') ? ' estimate' : ''
          }`
        : 'No revenue record available',
      badge: <ChangeBadge value={revenueChange} label="vs previous year" />,
      icon: 'monitoring',
      accent: COLORS.revenue,
    },
    {
      label: 'Average stay',
      value: latestStay ? `${formatNumber(latestStay.value, 1)} days` : '—',
      detail: latestStay ? `Reported for ${latestStay.year}` : 'No stay record available',
      badge: stayChange === null ? null : <ChangeBadge value={stayChange} suffix=" days" />,
      icon: 'hotel',
      accent: COLORS.stay,
    },
    {
      label: 'Top source market',
      flag: topMarketFlag,
      value: topMarketName || '—',
      detail:
        topSource?.arrivals != null
          ? `${formatNumber(topSource.arrivals)} arrivals`
          : 'No market record available',
      badge:
        topSource?.percent != null ? (
          <span className="inline-flex items-center rounded-md bg-canvas px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
            {formatPercent(topSource.percent)} share
          </span>
        ) : null,
      icon: 'public',
      accent: COLORS.arrivals,
    },
  ];

  return (
    <section
      id="tourism-section-indicators"
      className="grid scroll-mt-24 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Tourism key indicators"
    >
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </section>
  );
}
