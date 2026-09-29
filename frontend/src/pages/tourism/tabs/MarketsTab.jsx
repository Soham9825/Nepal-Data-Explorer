import { getCountryFlag } from '../../../utils/countryFlags';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { formatMarketName, formatNumber, formatPercent } from '../format';
import ChartPanel from '../components/ChartPanel';
import MiniStat from '../components/MiniStat';
import RankedBars from '../components/RankedBars';
import SelectControl from '../components/SelectControl';

/**
 * Source markets tab: the ranked origin countries for a year, with the source's
 * aggregate "Others" bucket reported underneath rather than ranked as a country.
 */
export default function MarketsTab({ markets, onYearChange, saveButton }) {
  const { countryMarkets, otherMarketTotal, topMarket, years, year, yearTotal } = markets;

  return (
    <div id="tourism-section-markets" className="scroll-mt-24 space-y-4">
      <ChartPanel
        title="Source markets"
        subtitle={`Ranked by international arrivals in ${year || 'the latest available year'}`}
        action={
          <>
            <SelectControl
              label="Year"
              value={year}
              onChange={onYearChange}
              options={years.map((option) => ({ value: option, label: option }))}
            />
            {saveButton}
          </>
        }
        note="Percentages use total arrivals for the selected year. The source’s aggregate “Others” category is shown separately and is not ranked as a country."
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat label="Total arrivals" value={formatNumber(yearTotal)} />
          <MiniStat
            label="Top market"
            flag={topMarket ? getCountryFlag(topMarket.nationality) : null}
            value={topMarket ? formatMarketName(topMarket.nationality) : '—'}
          />
          <MiniStat label="Countries represented" value={formatNumber(countryMarkets.length)} />
        </div>
        <RankedBars
          items={countryMarkets.map((market) => ({
            label: formatMarketName(market.nationality),
            flag: getCountryFlag(market.nationality),
            value: market.arrivals,
            share: market.share,
          }))}
          showFlags
          listTitle="Source markets by arrivals"
          unitLabel="Arrivals"
          maxHeight="max-h-[24rem]"
          color={COLORS.arrivals}
          emptyMessage="No country-level source-market records are available for this year."
        />
        {otherMarketTotal > 0 && (
          <div className="mt-5 flex flex-col gap-3 border border-outline-variant bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                <span aria-hidden="true" className="mr-1.5 text-base leading-none">
                  {getCountryFlag('')}
                </span>
                Other countries
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                An aggregate of source markets outside the individually reported countries.
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-sm font-bold tabular-nums text-ink">
                {formatNumber(otherMarketTotal)} arrivals
              </p>
              <p className="text-xs tabular-nums text-ink-muted">
                {yearTotal ? formatPercent((otherMarketTotal / yearTotal) * 100) : '—'} of total
              </p>
            </div>
          </div>
        )}
      </ChartPanel>
    </div>
  );
}
