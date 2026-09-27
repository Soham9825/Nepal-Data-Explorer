/**
 * Prices and wages sections. Both are index series on a fiscal-year axis, and both
 * draw every year the source reports, so neither carries a year picker.
 */
import { useMemo } from 'react';
import { selectAppiSeries, selectAppiTable, selectSalarySeries } from '../series';

/** Salary and wage-rate index per year, with the categories that are charted. */
export function useSalaryIndex(data) {
  return useMemo(() => selectSalarySeries(data), [data]);
}

/** The producer price index per year, with the products that are charted. */
export function useAppi(data) {
  return useMemo(() => selectAppiSeries(data), [data]);
}

/** The producer price dataset as table rows, all products and every year. */
export function useAppiTable(data) {
  return useMemo(() => selectAppiTable(data), [data]);
}
