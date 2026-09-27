/**
 * Trade sections: total trade, trade by partner, and the trade balance.
 *
 * All three read off the same payload and share the "trade" family in the nav.
 * Each of the first and last also offers a period picker, so each keeps its own
 * window; the partner section is cut by flow instead, which is why it resolves
 * the export and import series here rather than filtering inside the chart.
 *
 * The full, untruncated history is returned alongside the visible window because
 * the KPI cards and the CSV export both report the latest reading of the whole
 * series regardless of what the chart is showing.
 */
import { useMemo } from 'react';
import { tailRange } from '../format';
import { selectPartnerRows, selectTradeBalance, selectTradeHistory } from '../series';

/** Total exports and imports per fiscal year, plus the latest pair for the cards. */
export function useTrade(data, tradeRange) {
  return useMemo(() => {
    const history = selectTradeHistory(data);
    const latest = history.at(-1) || {};
    return {
      history,
      visibleRows: tailRange(history, tradeRange),
      year: latest.year,
      exports: latest.exports ?? null,
      imports: latest.imports ?? null,
    };
  }, [data, tradeRange]);
}

/**
 * Trade with each major partner. Both flows are returned whole: the toggle picks
 * which one the chart draws, and the CSV export writes both regardless.
 */
export function usePartners(data, partnerView) {
  return useMemo(() => {
    const exports = selectPartnerRows(data, 'exports');
    const imports = selectPartnerRows(data, 'imports');
    return {
      exports,
      imports,
      flow: partnerView,
      rows: partnerView === 'imports' ? imports : exports,
    };
  }, [data, partnerView]);
}

/** Exports minus imports per fiscal year, cut to the selected period window. */
export function useTradeBalance(data, balanceRange) {
  return useMemo(() => {
    const rows = selectTradeBalance(data);
    return { rows, visibleRows: tailRange(rows, balanceRange) };
  }, [data, balanceRange]);
}
