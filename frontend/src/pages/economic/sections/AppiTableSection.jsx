import AppiDataTable from '../components/AppiDataTable';
import { EMPTY_ARRAY } from '../constants';

/**
 * The producer price dataset as a table, under the chart.
 *
 * The chart draws five lines because a line chart stops separating them; this is the
 * rest of the data, so a reader who wants a product the chart left out has it here
 * rather than having to go to the CSV.
 */
function AppiTableSection({ view }) {
  const { appiTable } = view;
  const { years = EMPTY_ARRAY, rows = EMPTY_ARRAY } = appiTable;

  return <AppiDataTable years={years} rows={rows} />;
}

export const APPI_TABLE_SECTION = {
  id: 'appi_table',
  subtitle: (view) => {
    const { years = EMPTY_ARRAY, rows = EMPTY_ARRAY } = view.appiTable;
    return `${rows.length} products · ${years.length} fiscal years`;
  },
  action: () => null,
  content: AppiTableSection,
};
